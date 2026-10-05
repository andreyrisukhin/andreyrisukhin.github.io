/**
 * Author and copyright: Stefan Haack (https://shaack.com)
 * Repository: https://github.com/shaack/cm-chessboard
 * License: MIT, see file 'LICENSE'
 */
export const EXTENSION_POINT={positionChanged:"positionChanged",boardChanged:"boardChanged",moveInputToggled:"moveInputToggled",moveInput:"moveInput",beforeRedrawBoard:"beforeRedrawBoard",afterRedrawBoard:"afterRedrawBoard",redrawBoard:"redrawBoard",animation:"animation",destroy:"destroy"};export class Extension{constructor(e){this.chessboard=e}registerExtensionPoint(e,o){e===EXTENSION_POINT.redrawBoard&&(e=EXTENSION_POINT.afterRedrawBoard),this.chessboard.state.extensionPoints[e]||(this.chessboard.state.extensionPoints[e]=[]),this.chessboard.state.extensionPoints[e].push(o)}registerMethod(e,o){this.chessboard[e]?log.error("method",e,"already exists"):this.chessboard[e]=(...e)=>o.apply(this,e)}}