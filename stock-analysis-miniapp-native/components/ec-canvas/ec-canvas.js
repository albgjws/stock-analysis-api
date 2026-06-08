function wrapTouch(e) {
  const touch = e.touches[0];
  return { x: touch.pageX, y: touch.pageY };
}

Component({
  properties: {
    canvasId: { type: String, value: 'ec-canvas' },
    ec: { type: Object },
    forceUseOldCanvas: { type: Boolean, value: false },
  },
  data: { isUseNewCanvas: false },
  ready() {
    if (!this.data.ec) return;
    if (!this.data.ec.lazyLoad) this.init();
  },
  methods: {
    init(callback) {
      const version = wx.getSystemInfoSync().SDKVersion || '2.0.0';
      const isNew = version >= '2.9.0' && !this.data.forceUseOldCanvas;
      this.setData({ isUseNewCanvas: isNew });

      const query = this.createSelectorQuery();
      query.select('#ec-canvas-' + this.data.canvasId).fields({ node: true, size: true }).exec(res => {
        const canvasNode = res[0].node;
        const ctx = canvasNode.getContext(isNew ? '2d' : '2d');
        const dpr = wx.getSystemInfoSync().pixelRatio;
        canvasNode.width = res[0].width * dpr;
        canvasNode.height = res[0].height * dpr;
        ctx.scale(dpr, dpr);

        const chart = this.data.ec.onInit(canvasNode, ctx);
        this.triggerEvent('init', { chart });
        if (callback) callback(chart);
      });
    },
  },
});
