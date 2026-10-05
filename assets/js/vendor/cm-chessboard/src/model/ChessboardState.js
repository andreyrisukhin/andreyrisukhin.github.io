/**
 * Author and copyright: Stefan Haack (https://shaack.com)
 * Repository: https://github.com/shaack/cm-chessboard
 * License: MIT, see file 'LICENSE'
 */
import{Position}from"./Position.js";export class ChessboardState{constructor(){this.position=new Position,this.orientation=void 0,this.inputWhiteEnabled=!1,this.inputBlackEnabled=!1,this.squareSelectEnabled=!1,this.moveInputCallback=null,this.moveInputAnimate=void 0,this.extensionPoints={},this.moveInputProcess=Promise.resolve()}inputEnabled(){return this.inputWhiteEnabled||this.inputBlackEnabled}invokeExtensionPoints(t,i={}){const n=this.extensionPoints[t],s=Object.assign({},i);s.extensionPoint=t;let o=!0;if(n)for(const t of n)!1===t(s)&&(o=!1);return o}}