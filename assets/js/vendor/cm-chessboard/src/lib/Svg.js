/**
 * Author and copyright: Stefan Haack (https://shaack.com)
 * Repository: https://github.com/shaack/cm-chessboard
 * License: MIT, see file 'LICENSE'
 */
const SVG_NAMESPACE="http://www.w3.org/2000/svg";export class Svg{static createSvg(t){let e=document.createElementNS(SVG_NAMESPACE,"svg");return t&&(e.setAttribute("width","100%"),e.setAttribute("height","100%"),t.appendChild(e)),e}static addElement(t,e,r={}){let i=document.createElementNS(SVG_NAMESPACE,e);"use"===e&&(r["xlink:href"]=r.href);for(let t in r)if(r.hasOwnProperty(t))if(-1!==t.indexOf(":")){const e=t.split(":");i.setAttributeNS("http://www.w3.org/1999/"+e[0],e[1],r[t])}else i.setAttribute(t,r[t]);return t.appendChild(i),i}static removeElement(t){t&&t.parentNode&&t.parentNode.removeChild(t)}}