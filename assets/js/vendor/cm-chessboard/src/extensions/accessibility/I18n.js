/**
 * Author and copyright: Stefan Haack (https://shaack.com)
 * Repository: https://github.com/shaack/cm-chessboard
 * License: MIT, see file 'LICENSE'
 */
export const piecesTranslations={en:{colors:{w:"w",b:"b"},colors_long:{w:"White",b:"Black"},pieces:{p:"p",n:"n",b:"b",r:"r",q:"q",k:"k"},pieces_long:{p:"Pawn",n:"Knight",b:"Bishop",r:"Rook",q:"Queen",k:"King"}},de:{colors:{w:"w",b:"s"},colors_long:{w:"Wei\xdf",b:"Schwarz"},pieces:{p:"b",n:"s",b:"l",r:"t",q:"d",k:"k"},pieces_long:{p:"Bauer",n:"Springer",b:"L\xe4ufer",r:"Turm",q:"Dame",k:"K\xf6nig"}}};export function renderPieceTitle(e,n,o){let r=piecesTranslations[e].pieces_long[n];return o&&(r+=" "+piecesTranslations[e].colors_long[o]),r}