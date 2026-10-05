/**
 * Author and copyright: Stefan Haack (https://shaack.com)
 * Repository: https://github.com/shaack/cm-chessboard
 * License: MIT, see file 'LICENSE'
 */
import{Extension,EXTENSION_POINT}from"../../model/Extension.js";export class Persistence extends Extension{constructor(s,o){super(s),this.props=o,this.registerExtensionPoint(EXTENSION_POINT.positionChanged,this.savePosition.bind(this)),this.loadPosition()}savePosition(){localStorage.setItem("chessboard",JSON.stringify(this.chessboard.getPosition()))}loadPosition(){const s=localStorage.getItem("chessboard");s?this.chessboard.setPosition(JSON.parse(s)):this.chessboard.setPosition(this.props.initialPosition)}}