/** A cover crop in CSS pixels: the painting fills the view; `anchor` places it horizontally (0 shows the left edge, 1 the right). */
export function coverLayout(width:number,height:number,aspect:number,anchor:number) {
  const iw=Math.max(width,height*aspect),ih=iw/aspect;
  return {iw,ih,ox:(width-iw)*anchor,oy:(height-ih)*.5};
}
