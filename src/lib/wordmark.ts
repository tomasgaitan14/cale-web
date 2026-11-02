// Wordmark «cale» convertido a trazos, para los archivos que no pueden usar la tipografía del sitio (el lockup en SVG y la
// imagen para compartir). En el sitio el nombre sigue siendo texto en Manrope 800 (Brand.astro).
//
// Cómo se obtuvo (una sola vez, no es parte del build): Manrope 800 latina de @fontsource/manrope, abierta con opentype.js
// 2.0.0: font.getPath('cale', 0, 0, 1000, { letterSpacing: -0.05, kerning: true }).toPathData(0). Si cambia la tipografía
// o el espaciado de la marca, hay que volver a generarlo.

// Cuadrícula del trazo: tamaño de fuente de 1000, línea de base en y = 0 y el eje y hacia abajo (como en SVG)
export const WORDMARK_EM = 1000;

// Borde derecho del trazo (el espaciado negativo de la última letra lo hace pasar de lo que avanza el texto)
export const WORDMARK_RIGHT_EDGE = 1869;

// Distancia de la línea de base al centro vertical de la línea de texto, en em: (ascendente + descendente) / 2 con
// los valores de la fuente (2132 y -600 sobre 2000), que es como el navegador centra el texto de Brand.astro
export const WORDMARK_BASELINE_BELOW_CENTER = (2132 - 600) / 2 / 2000;

export const WORDMARK_PATH =
  'M308 15Q224 15 164-22Q104-60 72-124Q40-189 40-270Q40-352 73-416Q107-481 167-518Q228-555 310-555Q406-555 470-507Q535-458 553-375L417-339Q405-381 375-404Q346-428 308-428Q265-428 238-407Q210-386 197-351Q184-315 184-270Q184-199 215-156Q247-112 308-112Q354-112 378-133Q402-154 414-193L553-164Q530-78 466-31Q402 15 308 15M743 15Q685 15 645-7Q605-29 584-67Q563-104 563-149Q563-186 575-217Q586-248 612-272Q638-296 681-312Q711-323 753-331Q794-340 847-348Q878-352 912-357Q908-391 890-408Q867-431 813-431Q783-431 751-416Q718-402 705-365L582-404Q603-471 659-513Q716-555 813-555Q885-555 940-533Q996-511 1024-457Q1040-427 1043-397Q1046-367 1046-330L1046 0L927 0L927-66Q895-28 859-9Q813 15 743 15M772-92Q810-92 835-105Q861-118 876-135Q892-152 897-164Q908-186 910-215Q911-233 911-247Q877-241 853-237Q816-230 793-225Q770-219 752-213Q732-205 720-196Q708-186 702-175Q696-164 696-151Q696-132 705-119Q715-106 732-99Q749-92 772-92M1272 0L1136 0L1136-735L1272-735L1272 0M1623 15Q1540 15 1477-21Q1414-56 1378-119Q1342-182 1342-263Q1342-351 1377-417Q1412-482 1474-519Q1535-555 1615-555Q1700-555 1760-515Q1819-475 1848-402Q1876-330 1868-232L1489-232Q1495-183 1519-153Q1552-112 1615-112Q1655-112 1684-129Q1712-147 1727-180L1863-141Q1833-67 1767-26Q1701 15 1623 15M1492-333L1730-333Q1724-377 1707-401Q1681-437 1621-437Q1552-437 1519-395Q1500-370 1492-333';
