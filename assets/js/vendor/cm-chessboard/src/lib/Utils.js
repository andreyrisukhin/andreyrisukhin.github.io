/**
 * Author and copyright: Stefan Haack (https://shaack.com)
 * Repository: https://github.com/shaack/cm-chessboard
 * License: MIT, see file 'LICENSE'
 */
export class Utils{static delegate(t,e,n,s){const c=function(t){const e=t.target.closest(n);e&&this.contains(e)&&s.call(e,t)};return t.addEventListener(e,c),{remove:function(){t.removeEventListener(e,c)}}}static mergeObjects(t,e){const n=t=>t&&"object"==typeof t;if(!n(t)||!n(e))return e;for(const n of Object.keys(e))e[n]instanceof Object&&Object.assign(e[n],Utils.mergeObjects(t[n],e[n]));return Object.assign(t||{},e),t}static createDomElement(t){const e=document.createElement("template");return e.innerHTML=t.trim(),e.content.firstChild}static createTask(){let t,e;const n=new Promise((function(n,s){t=n,e=s}));return n.resolve=t,n.reject=e,n}static isAbsoluteUrl(t){return-1!==t.indexOf("://")||t.startsWith("/")}}