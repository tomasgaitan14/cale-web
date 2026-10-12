// Tests de la plantilla de CloudFormation (infra/site.yaml): seguridad, plan Free, alarmas y la función de URLs.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse, type Tags } from 'yaml';
import { describe, expect, it } from 'vitest';
import { ROUTES } from '../src/config';

const ROOT_DIR = join(import.meta.dirname, '..');
const DIST_DIR = join(ROOT_DIR, 'dist');
const NOT_FOUND_FILE = '404.html';
const MAX_FREE_PLAN_WAF_RULES = 5;

// Tags de CloudFormation como objetos planos: !Ref X → { Ref: 'X' }
const CFN_TAGS: Tags = ['Ref', 'GetAtt', 'Sub', 'Join'].flatMap((name) => [
  { tag: `!${name}`, resolve: (value: string) => ({ [name]: value }) },
  { tag: `!${name}`, collection: 'seq' as const, resolve: (seq: { toJSON(): unknown }) => ({ [name]: seq.toJSON() }) },
]);

interface Resource {
  Type: string;
  Properties: Record<string, any>;
}

const template = parse(readFileSync(join(ROOT_DIR, 'infra', 'site.yaml'), 'utf8'), { customTags: CFN_TAGS }) as {
  Resources: Record<string, Resource>;
};
const resources = template.Resources;

function propertiesOf(logicalId: string): Record<string, any> {
  const resource = resources[logicalId];
  if (!resource) throw new Error(`No existe el recurso ${logicalId}`);
  return resource.Properties;
}

// --- Función de CloudFront, ejecutada tal cual está en la plantilla ---

interface CloudFrontRequest {
  uri: string;
  querystring: Record<string, { value: string; multiValue?: { value: string }[] }>;
}

interface CloudFrontRedirect {
  statusCode: number;
  headers: { location: { value: string } };
}

const handler = new Function(`${propertiesOf('UrlRewriteFunction').FunctionCode}; return handler;`)() as (event: {
  request: CloudFrontRequest;
}) => CloudFrontRequest | CloudFrontRedirect;

function viewerRequest(uri: string, querystring: CloudFrontRequest['querystring'] = {}) {
  return handler({ request: { uri, querystring } });
}

function rewrittenUri(uri: string): string {
  const result = viewerRequest(uri);
  if ('statusCode' in result) throw new Error(`${uri} redirigió a ${result.headers.location.value}`);
  return result.uri;
}

describe('función de URLs limpias', () => {
  it.each(Object.values(ROUTES))('%s se sirve desde un archivo que existe en dist/', (route) => {
    expect(existsSync(join(DIST_DIR, rewrittenUri(route)))).toBe(true);
  });

  it('la home sirve index.html', () => {
    expect(rewrittenUri('/')).toBe('/index.html');
  });

  it.each(['/_astro/index.css', '/favicon.svg', '/_astro/newsreader-latin.woff2'])('no toca los assets: %s', (uri) => {
    expect(rewrittenUri(uri)).toBe(uri);
  });

  it.each([
    ['/privacidad.html', '/privacidad'],
    ['/privacidad/', '/privacidad'],
    ['/terminos//', '/terminos'],
    ['/index.html', '/'],
  ])('redirige %s a %s con 301', (uri, location) => {
    expect(viewerRequest(uri)).toEqual({
      statusCode: 301,
      statusDescription: 'Moved Permanently',
      headers: { location: { value: location } },
    });
  });

  it('conserva la query string al redirigir', () => {
    const result = viewerRequest('/privacidad.html', {
      fbclid: { value: 'abc' },
      tag: { value: 'a', multiValue: [{ value: 'a' }, { value: 'b' }] },
      flag: { value: '' },
    }) as CloudFrontRedirect;
    expect(result.headers.location.value).toBe('/privacidad?fbclid=abc&tag=a&tag=b&flag');
  });

  it('manda los 403 y 404 de S3 a la página 404 del sitio', () => {
    expect(existsSync(join(DIST_DIR, NOT_FOUND_FILE))).toBe(true);
    const errors = propertiesOf('Distribution').DistributionConfig.CustomErrorResponses;
    for (const code of [403, 404]) {
      expect(errors).toContainEqual(
        expect.objectContaining({ ErrorCode: code, ResponseCode: 404, ResponsePagePath: `/${NOT_FOUND_FILE}` }),
      );
    }
  });
});

describe('headers de seguridad', () => {
  const vercelHeaders: { key: string; value: string }[] = JSON.parse(
    readFileSync(join(ROOT_DIR, 'vercel.json'), 'utf8'),
  ).headers[0].headers;

  const addSecurityHeaders = new Function(
    `${propertiesOf('SecurityHeadersFunction').FunctionCode}; return handler;`,
  )() as (event: { response: { headers: Record<string, { value: string }> } }) => {
    headers: Record<string, { value: string }>;
  };

  // Respuesta de S3 con un header que la función tiene que pisar
  const { headers } = addSecurityHeaders({ response: { headers: { 'x-frame-options': { value: 'SAMEORIGIN' } } } });

  it.each(vercelHeaders.map((header) => [header.key, header.value]))('agrega %s igual que vercel.json', (key, value) => {
    expect(headers[key.toLowerCase()]).toEqual({ value });
  });

  it('pisa los headers que vengan del origen', () => {
    expect(headers['x-frame-options']).toEqual({ value: 'DENY' });
  });

  it('la distribución usa las dos funciones y fuerza HTTPS', () => {
    const behavior = propertiesOf('Distribution').DistributionConfig.DefaultCacheBehavior;
    expect(behavior.ViewerProtocolPolicy).toBe('redirect-to-https');
    expect(behavior.FunctionAssociations).toEqual([
      { EventType: 'viewer-request', FunctionARN: { GetAtt: 'UrlRewriteFunction.FunctionMetadata.FunctionARN' } },
      { EventType: 'viewer-response', FunctionARN: { GetAtt: 'SecurityHeadersFunction.FunctionMetadata.FunctionARN' } },
    ]);
  });
});

describe('bucket privado', () => {
  it('bloquea todo acceso público', () => {
    expect(propertiesOf('SiteBucket').PublicAccessBlockConfiguration).toEqual({
      BlockPublicAcls: true,
      BlockPublicPolicy: true,
      IgnorePublicAcls: true,
      RestrictPublicBuckets: true,
    });
  });

  it('solo CloudFront, y solo esta distribución, puede leerlo', () => {
    const statements = propertiesOf('SiteBucketPolicy').PolicyDocument.Statement;
    const allows = statements.filter((statement: any) => statement.Effect === 'Allow');
    expect(allows).toHaveLength(1);
    expect(allows[0].Principal).toEqual({ Service: 'cloudfront.amazonaws.com' });
    expect(allows[0].Action).toBe('s3:GetObject');
    expect(allows[0].Condition.StringEquals['AWS:SourceArn'].Sub).toContain('distribution/${Distribution}');
  });

  it('rechaza conexiones sin TLS', () => {
    const statements = propertiesOf('SiteBucketPolicy').PolicyDocument.Statement;
    expect(statements).toContainEqual(
      expect.objectContaining({ Effect: 'Deny', Condition: { Bool: { 'aws:SecureTransport': 'false' } } }),
    );
  });
});

describe('plan Free de CloudFront', () => {
  it('cubre la distribución, el web ACL y la zona de Route 53', () => {
    const plan = propertiesOf('PricingPlan');
    expect(plan).toMatchObject({ PlanFamily: 'CloudFront', PlanTier: 'FREE' });
    const arns = JSON.stringify(plan.ResourceArns);
    expect(arns).toContain('distribution/${Distribution}');
    expect(arns).toContain('WebAcl.Arn');
    expect(arns).toContain('hostedzone/${HostedZone}');
  });

  // Con cualquiera de estos recursos AWS rechaza la distribución ("not eligible for this subscription tier")
  it.each(['AWS::CloudFront::ResponseHeadersPolicy', 'AWS::CloudFront::CachePolicy', 'AWS::CloudFront::OriginRequestPolicy', 'AWS::CloudFront::KeyValueStore'])(
    'no usa %s, que el plan Free no admite',
    (type) => {
      expect(Object.values(resources).map((resource) => resource.Type)).not.toContain(type);
    },
  );

  it('la distribución no usa políticas de headers ni de origen propias', () => {
    const behavior = propertiesOf('Distribution').DistributionConfig.DefaultCacheBehavior;
    expect(behavior.ResponseHeadersPolicyId).toBeUndefined();
    expect(behavior.OriginRequestPolicyId).toBeUndefined();
  });

  it('el web ACL está asociado y no supera las reglas del plan Free', () => {
    expect(propertiesOf('Distribution').DistributionConfig.WebACLId).toEqual({ GetAtt: 'WebAcl.Arn' });
    const acl = propertiesOf('WebAcl');
    expect(acl.Scope).toBe('CLOUDFRONT');
    expect(acl.Rules.length).toBeLessThanOrEqual(MAX_FREE_PLAN_WAF_RULES);
    // Los rule groups propios no están soportados por el plan
    expect(JSON.stringify(acl.Rules)).not.toContain('RuleGroupReferenceStatement');
  });
});

describe('alarmas', () => {
  const alarms = Object.entries(resources).filter(([, resource]) => resource.Type === 'AWS::CloudWatch::Alarm');

  it('hay alarma de errores 5xx y de pico de tráfico', () => {
    const metrics = alarms.map(([, alarm]) => alarm.Properties.MetricName);
    expect(metrics).toEqual(expect.arrayContaining(['5xxErrorRate', 'Requests']));
  });

  it.each(alarms.map(([id]) => id))('%s avisa por email al dispararse y al volver a la normalidad', (id) => {
    const alarm = propertiesOf(id);
    expect(alarm.AlarmActions).toEqual([{ Ref: 'AlertsTopic' }]);
    expect(alarm.OKActions).toEqual([{ Ref: 'AlertsTopic' }]);
    expect(alarm.Dimensions).toContainEqual({ Name: 'DistributionId', Value: { Ref: 'Distribution' } });
  });

  it('el tópico manda las alarmas al email del parámetro', () => {
    expect(propertiesOf('AlertsTopic').Subscription).toEqual([{ Protocol: 'email', Endpoint: { Ref: 'AlertEmail' } }]);
  });
});

describe('workflow de deploy', () => {
  const workflow = parse(readFileSync(join(ROOT_DIR, '.github', 'workflows', 'deploy.yml'), 'utf8'));
  const steps: { uses?: string; run?: string; with?: Record<string, string> }[] = workflow.jobs.deploy.steps;
  const indexOf = (predicate: (step: (typeof steps)[number]) => boolean) => steps.findIndex(predicate);

  const testsStep = indexOf((step) => step.run === 'npm test');
  const credentialsStep = indexOf((step) => step.uses?.startsWith('aws-actions/configure-aws-credentials') ?? false);
  const uploadSteps = steps.flatMap((step, index) => (step.run?.includes('aws s3 sync') ? [index] : []));
  const invalidationStep = indexOf((step) => step.run?.includes('create-invalidation') ?? false);

  it('deploya solo desde main', () => {
    expect(workflow.on.push.branches).toEqual(['main']);
  });

  it('entra a AWS con OIDC, sin claves guardadas', () => {
    expect(workflow.permissions).toEqual({ 'id-token': 'write', contents: 'read' });
    expect(steps[credentialsStep].with?.['role-to-assume']).toBe('${{ vars.AWS_DEPLOY_ROLE_ARN }}');
    expect(JSON.stringify(workflow)).not.toMatch(/secrets\.|aws-access-key-id|aws-secret-access-key/i);
  });

  it('corre los tests antes de tocar AWS, y sube antes de invalidar', () => {
    expect(testsStep).toBeGreaterThanOrEqual(0);
    expect(credentialsStep).toBeGreaterThan(testsStep);
    expect(uploadSteps).toHaveLength(2);
    expect(Math.min(...uploadSteps)).toBeGreaterThan(credentialsStep);
    expect(invalidationStep).toBeGreaterThan(Math.max(...uploadSteps));
  });

  it('las páginas no pisan los assets con hash al borrar lo que sobra', () => {
    const pagesUpload = steps[uploadSteps.find((index) => !steps[index].run!.includes('dist/_astro'))!].run!;
    expect(pagesUpload).toContain('--delete');
    expect(pagesUpload).toContain('--exclude "_astro/*"');
  });
});

describe('rol de deploy de GitHub Actions', () => {
  const role = propertiesOf('DeployRole');

  it('solo lo puede asumir la rama main del repo, vía OIDC', () => {
    const [trust] = role.AssumeRolePolicyDocument.Statement;
    expect(trust.Principal).toEqual({ Federated: { Ref: 'GitHubOidcProvider' } });
    expect(trust.Condition.StringEquals['token.actions.githubusercontent.com:aud']).toBe('sts.amazonaws.com');
    expect(trust.Condition.StringEquals['token.actions.githubusercontent.com:sub']).toEqual({
      Sub: '${GitHubSubjectPrefix}:ref:refs/heads/main',
    });
  });

  // El repo usa el sub inmutable de GitHub: "repo:owner@ownerId/repo@repoId" (no se puede suplantar renombrando)
  it('el prefijo por defecto tiene el formato inmutable con los IDs', () => {
    const parameter = (template as unknown as { Parameters: Record<string, { Default: string; AllowedPattern: string }> })
      .Parameters.GitHubSubjectPrefix;
    expect(parameter.Default).toMatch(new RegExp(parameter.AllowedPattern));
    expect(parameter.Default).toMatch(/^repo:tomasgaitan14@\d+\/cale-web@\d+$/);
  });

  it('solo puede escribir en el bucket del sitio e invalidar esta distribución', () => {
    const statements = role.Policies.flatMap((policy: any) => policy.PolicyDocument.Statement);
    const actions = statements.flatMap((statement: any) => [statement.Action].flat());
    expect(actions.sort()).toEqual(['cloudfront:CreateInvalidation', 's3:DeleteObject', 's3:ListBucket', 's3:PutObject']);
    expect(JSON.stringify(statements)).not.toMatch(/"\*"|:\*"/);
  });
});
