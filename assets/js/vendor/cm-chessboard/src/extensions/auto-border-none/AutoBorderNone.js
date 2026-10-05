/**
 * Author and copyright: Stefan Haack (https://shaack.com)
 * Repository: https://github.com/shaack/cm-chessboard
 * License: MIT, see file 'LICENSE'
 */
import{Extension,EXTENSION_POINT}from"../../model/Extension.js";export class AutoBorderNone extends Extension{constructor(e,r={}){super(e),this.originalBorderType=e.props.style.borderType,this.props={chessboardBorderType:e.props.style.borderType,borderNoneBelow:540},Object.assign(this.props,r),this.registerExtensionPoint(EXTENSION_POINT.beforeRedrawBoard,this.extensionPointBeforeRedrawBoard.bind(this)),this.registerExtensionPoint(EXTENSION_POINT.destroy,(()=>{this.chessboard.props.style.borderType=this.originalBorderType}))}extensionPointBeforeRedrawBoard(){let e;e=this.chessboard.view.width<this.props.borderNoneBelow?"none":this.props.chessboardBorderType,e!==this.chessboard.props.style.borderType&&(this.chessboard.props.style.borderType=e,this.chessboard.view.updateMetrics())}}