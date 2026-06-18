var API = require('../../utils/api');
function $(v){return(v||0).toFixed(2)}
function $Y(v){return'¥'+(v||0).toFixed(2)}
function V(v){if(!v)return'0';if(v>=1e8)return(v/1e8).toFixed(2)+'亿';if(v>=1e4)return(v/1e4).toFixed(0)+'万';return''+v}

Page({
  data:{
    loading:1,error:'',code:'',stockName:'',
    priceText:'',cpText:'',chgText:'',cc:'neutral',
    hiText:'',loText:'',opText:'',pcText:'',volText:'',amtText:'',mcText:'',trText:'',
    marketTagClass:'tag-blue',marketTagText:'',
    isLive:0,lastRefresh:'',bid:[],ask:[],
    idxData:null,

    sig:null,sigLabel:'',sigClsName:'',ssc:'neutral',sigStrengthText:'',
    supText:'',resText:'',

    threeLocks:[],hasThreeLocks:0,tdSeq:[],hasTd:0,swingPts:[],hasSwing:0,dualCross:[],hasDualCross:0,limitPred:null,hasLimitPred:0,
    ffData:[],ffLatest:'',ffCount:0,ffSummary:'',ffInDays:0,ffSum5:'',ffSum5Val:0,ffDominant:'',ffIn:0,chipNow:'—',chipTrend:'—',chipClr:'#999',chipClrVal:'#722ed1',

    macdBars:[],macdSummary:'',macdDif:'',macdDea:'',macdBarVal:'',macdBarCls:'neutral',
    rsiBars:[],rsiSummary:'',rsiNow:'',
    kdjBars:[],kdjSummary:'',kdjK:'',kdjD:'',kdjJ:'',

    sigItems:[],sigDetails:[],sigBuyCount:0,sigSellCount:0,sigNeutralCount:0,

    tlBars:[],idOpenText:'',idAvgText:'',

    hk:0,klCount:0,klLastDate:'',klBars:[],
    predTrend:'',predCls:'neutral',predConf:'',predRange:'',

    r0:'',r1:'',r2:'',r3:'',rVol:'',rOp:'',rSL:'',rOutlook:'',

    slText:'',slReason:'',tpText:'',tpReason:'',

    bt:null,btDirClr:'',btDirTxt:'',btMae:'',btMax:'',btWithin:'',
    crScore:0,crProb:50,crSummary:'',crRating:'中性震荡',crGood:0,crBad:0,

    buyVal:'',diag:null,diagScoreCls:'',diagProbCls:'',diagProbTxt:'',diagSlText:'',diagTpText:'',
  },

  onLoad(o){
    this.setData({code:o.code||'',stockName:decodeURIComponent(o.name||o.code||'')});
    this.fetchData();
    this.fetchIndices();
    // 收盘后自动刷新
    this.scheduleCloseRefresh();
  },

  fetchData(){
    var c=this.data.code;if(!c){this.setData({error:'缺少股票代码',loading:0});return}
    this.setData({loading:1,error:''});var me=this;
    Promise.all([
      API.getAnalysis(c),API.getIntraday(c).catch(function(){return null}),
      API.getFundFlow(c).catch(function(){return[]}),API.getBacktest(c).catch(function(){return null}),
    ]).then(function(r){me.process(r[0],r[1],r[3],r[2])})
    .catch(function(e){me.setData({error:e.message||'加载失败',loading:0})});
  },

  process(a,id,bt,ff){
    var info=a.info||{},sig=a.signals||{},kl=a.kline||[],pred=a.prediction||{};
    if(!ff)ff=a.fundFlow||[];
    var hk=kl.length>0,ch=info.change||0,cc=ch>0?'up':ch<0?'down':'neutral';
    var mk=(info.market||'').toLowerCase();
    var ss=sig.strength||0,ssc=ss>0?'up':ss<0?'down':'neutral';

    // 信号标签映射
    var slM={STRONG_BUY:'强烈建仓',BUY:'建议建仓',HOLD:'观望为主',SELL:'减仓观望',STRONG_SELL:'清仓离场'};
    var scM={STRONG_BUY:'SBUY',BUY:'BUY',HOLD:'HOLD',SELL:'SELL',STRONG_SELL:'SSELL'};

    // 技术指标表格+详情
    var sd=sig.details||[],bC=0,sC=0,nC=0;
    var si=sd.map(function(d){
      var sc=d.score||0;if(d.signal==='BUY')bC++;else if(d.signal==='SELL')sC++;else nC++;
      return{name:d.indicator,tagCls:d.signal==='BUY'?'red':d.signal==='SELL'?'green':'yellow',
        label:d.signal==='BUY'?'买入':d.signal==='SELL'?'卖出':'中性',
        cls:sc>=0?'up':'down',score:(sc>0?'+':'')+sc,pct:Math.min(100,Math.abs(sc)/2*100)||5};
    });
    var sDet=sd.map(function(d){return{name:d.indicator,desc:d.description,tagCls:d.signal==='BUY'?'red':d.signal==='SELL'?'green':'yellow'}});

    // 三把锁
    var tl=[];if(hk&&kl.length>30){var avs=[];
      for(var i=20;i<kl.length;i++)avs.push(kl.slice(i-20,i).reduce(function(s,b){return s+b.volume},0)/20);
      for(var i=25;i<kl.length;i++){var bar=kl[i],prev=kl[i-1],ma20=bar.ma&&bar.ma.ma20;
        if(!ma20||!bar.macd||!avs[i-20]||avs[i-20]<=0)continue;
        var lks=[],ct=0;
        if(bar.close>ma20){lks.push('突破MA20('+$(ma20)+')');ct++;}
        if(bar.macd.dif>bar.macd.dea&&prev.macd&&prev.macd.dif<=prev.macd.dea){lks.push('MACD金叉');ct++;}
        if(bar.volume>avs[i-20]*1.5){lks.push('放量'+(bar.volume/avs[i-20]).toFixed(1)+'倍');ct++;}
        if(ct>=2)tl.push({date:bar.date,lockCount:ct,type:ct===3?'buy':'weak_buy',details:lks});
      }
    }

    // 神奇九转
    var td=[],uc=0,dc=0;if(hk){for(var i=4;i<kl.length;i++){
      if(kl[i].close>kl[i-4].close){uc++;dc=0;if(uc<=9)td.push({date:kl[i].date,count:uc,isReversal:uc===9});if(uc>9)uc=9;}
      else if(kl[i].close<kl[i-4].close){dc++;uc=0;if(dc<=9)td.push({date:kl[i].date,count:-dc,isReversal:dc===9});if(dc>9)dc=9;}
      else{uc=0;dc=0;}
    }}

    // 波段
    var sw=[];if(hk){for(var i=3;i<kl.length;i++){
      var b=kl[i],p=kl[i-1];
      if(b.kdj&&p.kdj&&b.kdj.k>b.kdj.d&&p.kdj.k<=p.kdj.d&&b.kdj.k<40)sw.push({date:b.date,type:'buy',reason:'KDJ低位金叉'});
      if(b.kdj&&p.kdj&&b.kdj.k<b.kdj.d&&p.kdj.k>=p.kdj.d&&b.kdj.k>60)sw.push({date:b.date,type:'sell',reason:'KDJ高位死叉'});
    }}

    // MACD+KDJ 组合双金叉/双死叉
    var dc=[];if(hk){var WIN=3;
      // 标记每根K线的十字状态
      var marks=[];
      for(var i=1;i<kl.length;i++){
        var b=kl[i],p=kl[i-1];
        if(!b.macd||!p.macd||!b.kdj||!p.kdj)continue;
        var mg=b.macd.dif>b.macd.dea&&p.macd.dif<=p.macd.dea;
        var md=b.macd.dif<b.macd.dea&&p.macd.dif>=p.macd.dea;
        var kg=b.kdj.k>b.kdj.d&&p.kdj.k<=p.kdj.d&&b.kdj.k<40;
        var kd=b.kdj.k<b.kdj.d&&p.kdj.k>=p.kdj.d&&b.kdj.k>60;
        if(mg||md||kg||kd)marks.push({i:i,date:b.date,mg:mg,md:md,kg:kg,kd:kd});
      }
      // 相邻3根内找MACD+KDJ同时出现
      var used={};
      for(var i=0;i<marks.length;i++){
        if(used[i])continue;
        var m=marks[i];
        for(var j=i+1;j<marks.length&&j<=i+WIN;j++){
          if(used[j])continue;
          var n=marks[j];
          if((m.mg||n.mg)&&(m.kg||n.kg)){
            var li=Math.max(m.i,n.i);
            dc.push({date:kl[li].date,type:'golden',detail:'双金叉',strength:(m.mg&&m.kg)||(n.mg&&n.kg)?2:1});
            used[i]=used[j]=1;break;
          }
          if((m.md||n.md)&&(m.kd||n.kd)){
            var li=Math.max(m.i,n.i);
            dc.push({date:kl[li].date,type:'death',detail:'双死叉',strength:(m.md&&m.kd)||(n.md&&n.kd)?2:1});
            used[i]=used[j]=1;break;
          }
        }
      }
    }

    // 涨停/跌停连板预测
    var lp=null;
    // 优先使用接口返回的涨跌停价
    var isUp=false,isDown=false;
    if(info.limitUp!=null&&info.price>=info.limitUp-0.01)isUp=true;
    if(info.limitDown!=null&&info.price<=info.limitDown+0.01)isDown=true;
    // 降级：用百分比判断
    if(!isUp&&!isDown&&!info.limitUp&&!info.limitDown){
      var lastBar=kl.length>0?kl[kl.length-1]:null;
      var prevBar2=kl.length>1?kl[kl.length-2]:null;
      var klinePct=lastBar&&prevBar2?((lastBar.close-prevBar2.close)/prevBar2.close*100):0;
      var chPct=info.changePercent||0;
      var effPct=Math.abs(chPct)>Math.abs(klinePct)*1.5?klinePct:chPct;
      isUp=effPct>=9.6;isDown=effPct<=-9.6;
    }
    if(isUp||isDown){
      var avgVol=0;for(var i=Math.max(0,kl.length-20);i<kl.length;i++)avgVol+=kl[i].volume;
      avgVol=avgVol/Math.min(20,kl.length);
      var volRate=avgVol>0?((info.volume||0)/avgVol):1;
      // 计算连板数
      var lc=1;
      for(var i=kl.length-2;i>=0&&i>=kl.length-6;i--){
        var b=kl[i],p2=i>0?kl[i-1]:null;
        if(p2&&p2.close>0){var pct2=(b.close-p2.close)/p2.close*100;if(isUp&&pct2>=8.6)lc++;else if(!isUp&&pct2<=-8.6)lc++;else break;}
        else break;
      }
      // 概率计算
      var prob=50,facts=[];
      if(isUp){
        if(volRate<0.5){prob+=20;facts.push('缩量封板');}else if(volRate<0.8){prob+=10;facts.push('量能适中');}else if(volRate>1.2){prob-=10;facts.push('放量分歧');}
      }else{
        if(volRate<0.5){prob+=5;facts.push('缩量跌停');}else{prob+=10;facts.push('放量跌停');}
      }
      var mcap=info.marketCap||0;
      if(mcap>0){if(mcap<30){prob+=15;facts.push('小盘');}else if(mcap<80){prob+=8;}else if(mcap>200){prob-=10;facts.push('大盘');}}
      if(lc===1){prob+=10;facts.push('首板');}else if(lc===2){prob+=5;}else if(lc===3){prob-=5;}else{prob-=Math.min(20,lc*5);facts.push(lc+'板高位');}
      var jVal=kl[kl.length-1]&&kl[kl.length-1].kdj?kl[kl.length-1].kdj.j:null;
      if(jVal!=null&&isUp){if(jVal<60){prob+=10;}else if(jVal<80){prob+=5;}else{prob-=10;}}
      prob=Math.max(5,Math.min(95,prob));
      lp={isUp:isUp?1:0,consecutiveCount:lc,nextDayProb:prob,factors:facts};
    }

    // 资金流向
    var ffD=ff.slice(-30).map(function(f){return{h:Math.abs(f.mainNetInflowPercent||0)*2,c:(f.mainNetInflowPercent||0)>=0?'#cf1322':'#3cb371'}});
    var ffL=ff.length>0?$(ff[ff.length-1].mainNetInflowPercent):'';
    // 资金流向文字总结
    var ffLast=ff[ff.length-1]||{},ffPct=ffLast.mainNetInflowPercent||0,ffIn=ffPct>0;
    var ffLast5=ff.slice(-5),ffInDays=0,ffSum5=0;
    ffLast5.forEach(function(f){if((f.mainNetInflowPercent||0)>0)ffInDays++;ffSum5+=(f.mainNetInflowPercent||0);});
    var ffSummary='';
    if(ffIn&&ffInDays>=3)ffSummary='主力连续净流入，资金积极做多';
    else if(ffIn)ffSummary='主力今日净流入，关注持续性';
    else if(ffInDays<=1&&ffSum5<-2)ffSummary='主力持续流出，资金态度偏空';
    else if(ffInDays<=1)ffSummary='主力近期以流出为主，谨慎观望';
    else ffSummary='主力进出交替，方向不明确';
    var ffDominant=ffInDays>=3?'✅ 多头主导':ffInDays<=1?'❌ 空头主导':'⚪ 多空拉锯';
    // 筹码集中度计算
    var chipVals=[],chipSum=0;ff.forEach(function(f){
      var big=(f.superLargeNetInflowPercent||0)+(f.largeNetInflowPercent||0);
      var small=(f.mediumNetInflowPercent||0)+(f.smallNetInflowPercent||0);
      chipSum+=(big-small);chipVals.push(chipSum);
    });
    var chipNow=chipVals.length>0?chipVals[chipVals.length-1]:0;
    var chipPrev=chipVals.length>5?chipVals[chipVals.length-5]:0;
    var chipDiff=chipNow-chipPrev;
    var chipIsPositive=chipNow>=0;
    var chipTrend='—',chipClr='#999';
    if(chipVals.length>5){
      if(chipIsPositive){chipTrend=chipDiff>0?'加仓':'减仓';chipClr=chipDiff>0?'#cf1322':'#3cb371';}
      else{chipTrend=chipDiff>0?'缓解':'加重';chipClr=chipDiff>0?'#faad14':'#3cb371';}
    }
    chipNow=chipNow.toFixed(1);
    var chipClrVal=chipIsPositive?'#cf1322':'#3cb371';

    // MACD
    var md=kl.map(function(b){return b.macd}).filter(Boolean).slice(-35);
    var mx=Math.max.apply(null,md.map(function(d){return Math.abs(d.macd||0)}))||1;
    var mb=md.map(function(d){return{h:Math.abs(d.macd||0)/mx*60,c:(d.macd||0)>=0?'#cf1322':'#3cb371'}});
    var lm=md[md.length-1]||{};

    // RSI
    var rv=kl.map(function(b){return b.rsi&&b.rsi.rsi6}).filter(function(v){return v!=null}).slice(-35);
    var rn=rv[rv.length-1]||50,rb=rv.map(function(v){return{h:v/100*68,c:v>70?'#cf1322':v<30?'#3cb371':'#722ed1'}});

    // KDJ
    var kv=kl.map(function(b){return b.kdj}).filter(Boolean).slice(-35);
    var lk=kv[kv.length-1]||{},kb=kv.map(function(d){return{k:(d.k||0)/100*70+10,d:(d.d||0)/100*70+10}});

    // K线
    var klr=kl.slice(-30),pp=klr.map(function(b){return b.close}).filter(function(v){return v!=null});
    var mn=Math.min.apply(null,pp),mx2=Math.max.apply(null,pp),rg=mx2-mn||1;
    var kbs=klr.map(function(b){return{h:(b.close-mn)/rg*85+5,c:(b.changePercent||0)>=0?'#cf1322':'#3cb371',date:b.date}});

    // 预测
    var tM={up:'上涨',down:'下跌',sideways:'震荡'},cM={high:'高',medium:'中',low:'低'};
    var fc=pred.forecast||[],lpf=fc[fc.length-1];
    var predRange=lpf?$Y(lpf.lower95)+' ~ '+$Y(lpf.upper95):'—';

    // 分时
    var idD=id&&id.data||[],idP=idD.map(function(p){return p.price}),idMn=Math.min.apply(null,idP),idMx=Math.max.apply(null,idP),idR=idMx-idMn||.01,pc=id&&id.preClose||0;
    var tb=idD.map(function(p){return{h:(p.price-idMn)/idR*75+12,c:p.price>=pc?'#cf1322':'#3cb371'}});

    // 复盘
    var lb=hk?kl[kl.length-1]:{},avg=hk?kl.slice(-20).reduce(function(s,b){return s+b.volume},0)/20:0,tv=lb.volume||0;

    // 操作建议
    var isBuy=sig.overall==='STRONG_BUY'||sig.overall==='BUY';
    var isSell=sig.overall==='STRONG_SELL'||sig.overall==='SELL';
    var opAdvice=isBuy?'综合信号偏多，可逢低关注，支撑位 '+$Y(sig.support):isSell?'综合信号偏空，注意风险，阻力位 '+$Y(sig.resistance):'信号中性，多看少动';

    // 后市预测
    var tr=pred.trend||'sideways';
    var outlookText='预测后市'+(tr==='up'?'震荡上行':tr==='down'?'仍有调整压力':'维持震荡整理')+'（'+pred.method+'模型）';

    this.setData({
      loading:0,stockName:this.data.stockName||info.name||'',
      priceText:$Y(info.price),cc,
      cpText:(info.changePercent>=0?'+':'')+$(info.changePercent)+'%',
      chgText:(ch>=0?'+':'')+$(ch),
      hiText:$Y(info.high),loText:$Y(info.low),opText:$Y(info.open||info.price),pcText:$Y(info.prevClose||info.price-ch),
      volText:V(info.volume),amtText:V(info.amount),
      mcText:info.marketCap?V(info.marketCap):'—',
      trText:info.turnoverRate?info.turnoverRate.toFixed(2)+'%':'—',
      marketTagText:mk==='sh'?'SH':mk==='sz'?'SZ':'HK',
      marketTagClass:mk==='sh'?'tag-red':mk==='sz'?'tag-green':'tag-blue',

      sig,sigLabel:slM[sig.overall]||'—',sigClsName:scM[sig.overall]||'HOLD',
      ssc,sigStrengthText:(ss>0?'+':'')+ss,
      supText:$Y(sig.support),resText:$Y(sig.resistance),

      threeLocks:tl.slice(-3),hasThreeLocks:tl.length>0?1:0,
      tdSeq:td.slice(-10),hasTd:td.length>0?1:0,
      swingPts:sw.slice(-3),hasSwing:sw.length>0?1:0,
      dualCross:dc,hasDualCross:dc.length>0?1:0,
      limitPred:lp,hasLimitPred:lp?1:0,
      ffData:ffD,ffLatest:ffL,ffCount:ffD.length,
      ffSummary:ffSummary,ffInDays:ffInDays,ffSum5:$(ffSum5),ffSum5Val:ffSum5,ffDominant:ffDominant,ffIn:ffIn?1:0,
      chipNow:chipNow,chipTrend:chipTrend,chipClr:chipClr,chipClrVal:chipClrVal,

      macdBars:mb,macdSummary:(lm.dif?'· '+(lm.dif>lm.dea?'多头':'空头'):''),
      macdDif:$(lm.dif),macdDea:$(lm.dea),macdBarVal:$(lm.macd),macdBarCls:(lm.macd||0)>=0?'up':'down',
      rsiBars:rb,rsiSummary:'· '+(rn>70?'超买':rn<30?'超卖':'中性'),rsiNow:rn.toFixed(1),
      kdjBars:kb,kdjSummary:'· '+(lk.k?(lk.k>lk.d?'多头':'空头'):''),kdjK:$(lk.k),kdjD:$(lk.d),kdjJ:$(lk.j),

      sigItems:si,sigDetails:sDet,sigBuyCount:bC,sigSellCount:sC,sigNeutralCount:nC,

      tlBars:tb,idOpenText:$Y(idD[0]&&idD[0].price),idAvgText:$Y(idD[idD.length-1]&&idD[idD.length-1].avgPrice),

      hk:1,klCount:kl.length,klLastDate:lb.date,klBars:kbs,
      predTrend:tM[tr]||'—',predCls:tr==='up'?'up':tr==='down'?'down':'neutral',
      predConf:cM[pred.confidence]||'—',predRange:predRange,

      r0:'今日'+(ch>=0?'上涨':'下跌')+Math.abs(info.changePercent||0).toFixed(2)+'%，最新价'+$Y(info.price),
      rVol:avg>0?'成交量：今日'+(tv/avg).toFixed(1)+'倍于20日均量':'量能：—',
      r1:lb.ma?'均线：'+(lb.close>(lb.ma.ma5||0)?'站上MA5':'跌破MA5')+'，'+(lb.close>(lb.ma.ma20||0)?'MA20上方运行':'MA20下方运行'):'均线：数据不足',
      r2:lb.macd?'MACD：'+(lb.macd.dif>lb.macd.dea?'多头（DIF='+$(lb.macd.dif)+'>DEA='+$(lb.macd.dea)+'）':'空头（DIF='+$(lb.macd.dif)+'<DEA='+$(lb.macd.dea)+'）'):'MACD：—',
      r3:lb.rsi?'RSI(6)：'+rn.toFixed(1)+'，处于'+(rn>70?'超买区，注意回调风险':rn<30?'超卖区，关注反弹机会':'中性区间'):'RSI：—',
      rOp:'【'+(isBuy?'建议买入':isSell?'建议卖出':'持有观望')+'】'+opAdvice,
      rSL:'止损 '+$Y(sig.stopLoss&&sig.stopLoss.price)+'（'+((sig.stopLoss&&sig.stopLoss.percent)||0)+'%）· 止盈 '+$Y(sig.takeProfit&&sig.takeProfit.price)+'（+'+(sig.takeProfit&&sig.takeProfit.percent||0)+'%）',
      rOutlook:outlookText+' ⚠️ 以上分析基于历史数据，不构成投资建议',

      slText:$Y(sig.stopLoss&&sig.stopLoss.price),slReason:sig.stopLoss&&sig.stopLoss.reason||'',
      tpText:$Y(sig.takeProfit&&sig.takeProfit.price),tpReason:sig.takeProfit&&sig.takeProfit.reason||'',

      bt:bt,

      // 收盘评分计算
      var crScore=0,crProb=50,crSummary='',crR='中性震荡',crGood=0,crBad=0;
      var crDetails=[];
      // KDJ
      if(lb.kdj&&lk.d!=null&&lk.k!=null){
        var kdjS=0;
        if(lk.k>lk.d&&lk.k<40)kdjS=18;else if(lk.k>lk.d&&lk.k<60)kdjS=12;else if(lk.k>lk.d)kdjS=6;else if(lk.k<lk.d&&lk.k>60)kdjS=-18;else if(lk.k<lk.d)kdjS=-8;
        if(lk.j>100)kdjS-=5;if(lk.j<0)kdjS+=5;
        crScore+=kdjS;crDetails.push(kdjS>0);if(kdjS>0)crGood++;else crBad++;
      }
      // MACD
      if(lb.macd&&kl.length>1){var pm=kl[kl.length-2].macd;if(pm){var mS=0;
        if(lb.macd.dif>lb.macd.dea&&lb.macd.macd>0)mS=12;else if(lb.macd.dif>lb.macd.dea)mS=6;else if(lb.macd.dif<lb.macd.dea&&lb.macd.macd<0)mS=-12;else mS=-6;
        if(lb.macd.macd>pm.macd)mS+=3;else mS-=3;
        crScore+=mS;if(mS>0)crGood++;else crBad++;
      }}
      // RSI
      if(rn!=null){var rS=rn<30?12:rn<45?8:rn<55?2:rn<70?-4:-12;crScore+=rS;if(rS>0)crGood++;else crBad++;}
      // 均线
      if(lb.ma){var maS=0;if(lb.close>lb.ma.ma5&&lb.ma.ma5>lb.ma.ma10&&lb.ma.ma10>lb.ma.ma20)maS=15;else if(lb.close>lb.ma.ma5&&lb.ma.ma5>lb.ma.ma10)maS=10;else if(lb.close>lb.ma.ma20)maS=5;else if(lb.ma.ma60&&lb.close<lb.ma.ma60)maS=-15;else if(lb.close<lb.ma.ma20)maS=-10;else if(lb.close<lb.ma.ma10)maS=-5;
        crScore+=maS;if(maS>0)crGood++;else crBad++;}
      // 成交量
      if(avg>0){var vr=tv/avg,dir=lb.changePercent||0,vS=0;
        if(dir>0&&vr>1.5)vS=12;else if(dir>0&&vr>1)vS=8;else if(dir>0)vS=4;else if(dir<0&&vr<0.7)vS=4;else if(dir<0&&vr>1.5)vS=-12;else if(dir<0)vS=-6;
        crScore+=vS;if(vS>0)crGood++;else crBad++;}
      // 布林带
      if(lb.boll&&lb.boll.upper>lb.boll.lower){var pos=(lb.close-lb.boll.lower)/(lb.boll.upper-lb.boll.lower);
        var bS=pos<0.1?8:pos<0.3?5:pos<0.5?2:pos<0.7?-2:pos<0.9?-5:-8;
        crScore+=bS;if(bS>0)crGood++;else crBad++;}
      crScore=Math.max(-100,Math.min(100,crScore));
      crProb=Math.round(((crScore+100)/200)*100);
      if(crScore>=50){crR='强烈看涨';}else if(crScore>=20){crR='看涨';}else if(crScore<=-50){crR='强烈看跌';}else if(crScore<=-20){crR='看跌';}
      // 与综合信号对齐
      var isSigSell=sig.overall==='SELL'||sig.overall==='STRONG_SELL';
      var isSigBuy=sig.overall==='BUY'||sig.overall==='STRONG_BUY';
      if(isSigSell&&(crR==='强烈看涨'||crR==='看涨')){crR='中性（信号偏空）';crSummary='综合信号偏空，注意风险';crProb=Math.min(crProb,50);}
      if(isSigBuy&&(crR==='强烈看跌'||crR==='看跌')){crR='中性（信号偏多）';crSummary='综合信号偏多，谨慎看涨';crProb=Math.max(crProb,50);}
      crSummary=crGood>=5?'多项指标共振向好，明日看涨概率较高':crBad>=5?'多项指标偏空，注意回调风险':crGood>crBad?'指标偏多，谨慎看涨':crBad>crGood?'指标偏空，注意风险':'指标中性，方向不明确';
      btDirClr:bt&&bt.metrics&&bt.metrics.directionCorrect?'#52c41a':'#ff4d4f',
      btDirTxt:bt&&bt.metrics&&bt.metrics.directionCorrect?'正确':'错误',
      btMae:'¥'+((bt&&bt.metrics&&bt.metrics.mae)||0).toFixed(2),
      btMax:'¥'+((bt&&bt.metrics&&bt.metrics.maxError)||0).toFixed(2),
      btWithin:((bt&&bt.metrics&&bt.metrics.within80)||0)+'%',

      // 收盘评分
      crScore:crScore,crProb:crProb,crSummary:crSummary,crRating:crR,crGood:crGood,crBad:crBad,
    });
  },

  onBuyInput(e){this.setData({buyVal:e.detail.value})},

  // ===== 大盘指数 =====
  fetchIndices(){
    var me=this;
    API.getMarketIndices().then(function(d){
      if(!d||!d.length)return;
      var arr=d.map(function(idx){
        var ch=idx.change||0;
        return{
          code:idx.code,
          name:idx.name,
          price:idx.price.toFixed(2),
          pct:(ch>=0?'+':'')+idx.changePercent.toFixed(2)+'%',
          cls:ch>0?'up':ch<0?'down':'neutral',
        };
      });
      me.setData({idxData:arr});
    }).catch(function(){});
  },

  // ===== 实时轮询 =====
  isMarketOpen(){
    var d=new Date(),h=d.getHours(),m=d.getMinutes(),day=d.getDay();
    if(day===0||day===6)return 0; // 周末
    var t=h*60+m;
    return(t>=555&&t<690)||(t>=780&&t<900)?1:0; // 9:15-11:30, 13:00-15:00
  },

  startPolling(){
    this.stopPolling();
    var me=this;
    // 报价轮询 5秒
    me._quoteTimer=setInterval(function(){
      if(!me.isMarketOpen()){me.setData({isLive:0});return}
      me.setData({isLive:1,lastRefresh:new Date().toLocaleTimeString()});
      API.getQuote(me.data.code).then(function(q){
        if(!q)return;
        var ch=q.change||0,cc=ch>0?'up':ch<0?'down':'neutral';
        // 五档处理
        var bidArr=[],askArr=[],maxV=1;
        if(q.bid&&q.bid.length){bidArr=q.bid.map(function(b){return{price:b.price,volume:b.volume,volTxt:b.volume>=1e4?(b.volume/1e4).toFixed(1)+'万':''+b.volume,volPct:0}});maxV=Math.max.apply(null,q.bid.map(function(b){return b.volume}))}
        if(q.ask&&q.ask.length){askArr=q.ask.map(function(a){return{price:a.price,volume:a.volume,volTxt:a.volume>=1e4?(a.volume/1e4).toFixed(1)+'万':''+a.volume,volPct:0}});maxV=Math.max(maxV,Math.max.apply(null,q.ask.map(function(a){return a.volume})))}
        if(maxV>0){bidArr=bidArr.map(function(b){b.volPct=Math.round(b.volume/maxV*100);return b});askArr=askArr.map(function(a){a.volPct=Math.round(a.volume/maxV*100);return a})}
        me.setData({
          priceText:'¥'+(q.price||0).toFixed(2),cc:cc,
          cpText:(q.changePercent>=0?'+':'')+$(q.changePercent)+'%',
          chgText:(ch>=0?'+':'')+$(ch),
          hiText:q.high?'¥'+$(q.high):me.data.hiText,
          loText:q.low?'¥'+$(q.low):me.data.loText,
          volText:q.volume?V(q.volume):me.data.volText,
          amtText:q.amount?V(q.amount):me.data.amtText,
          trText:q.turnoverRate?q.turnoverRate.toFixed(2)+'%':me.data.trText,
          bid:bidArr,ask:askArr,
        });
      }).catch(function(){});
    },5000);
    // 分时轮询 15秒
    me._tlTimer=setInterval(function(){
      if(!me.isMarketOpen())return;
      API.getIntraday(me.data.code).then(function(id){
        if(!id||!id.data||!id.data.length)return;
        var idD=id.data,idP=idD.map(function(p){return p.price});
        var idMn=Math.min.apply(null,idP),idMx=Math.max.apply(null,idP),idR=idMx-idMn||.01,pc=id.preClose||0;
        var tb=idD.map(function(p){return{h:(p.price-idMn)/idR*75+12,c:p.price>=pc?'#cf1322':'#3cb371'}});
        me.setData({
          tlBars:tb,
          idOpenText:'¥'+$(idD[0]&&idD[0].price),
          idAvgText:'¥'+$(idD[idD.length-1]&&idD[idD.length-1].avgPrice),
        });
      }).catch(function(){});
    },15000);
    // 大盘轮询 30秒
    me._idxTimer=setInterval(function(){me.fetchIndices()},30000);
  },

  stopPolling(){
    if(this._quoteTimer){clearInterval(this._quoteTimer);this._quoteTimer=null}
    if(this._tlTimer){clearInterval(this._tlTimer);this._tlTimer=null}
    if(this._idxTimer){clearInterval(this._idxTimer);this._idxTimer=null}
    if(this._closeTimer){clearTimeout(this._closeTimer);this._closeTimer=null}
  },

  onShow(){this.startPolling()},
  onHide(){this.stopPolling()},

  // 收盘后（15:01）自动刷新一次
  scheduleCloseRefresh(){
    var me=this;
    var now=new Date(),h=now.getHours(),m=now.getMinutes();
    var t=h*100+m;
    if(t<915||t>=1505)return;
    var ct=new Date();ct.setHours(15,1,0,0);
    var delay=ct.getTime()-now.getTime();
    if(delay<=0)return;
    me._closeTimer=setTimeout(function(){
      API.getQuote(me.data.code).then(function(q){
        if(!q)return;
        var ch=q.change||0,cc=ch>0?'up':ch<0?'down':'neutral';
        me.setData({priceText:'¥'+(q.price||0).toFixed(2),cc:cc,lastRefresh:'收盘 '+new Date().toLocaleTimeString()});
      }).catch(function(){});
    },delay);
  },

  doDiag(){
    var p=parseFloat(this.data.buyVal);if(!p||p<=0){wx.showToast({title:'请输入有效价格',icon:'none'});return}
    var me=this;
    wx.request({
      url:'https://stock-analysis-ryan.xyz/api/stock/'+this.data.code+'/purchase-analysis?buyPrice='+p,
      success:function(r){
        if(r.statusCode===200){
          var d=r.data;
          me.setData({
            diag:d,diagScoreCls:d.score>=65?'up':'down',
            diagProbCls:d.probability&&d.probability.up>=50?'up':'down',
            diagProbTxt:(d.probability&&d.probability.up||0)+'%',
            diagSlText:$Y(d.stopLoss&&d.stopLoss.price),diagTpText:$Y(d.takeProfit&&d.takeProfit.price),
          });
        }else wx.showToast({title:'诊断失败',icon:'none'});
      },
      fail:function(){wx.showToast({title:'网络错误',icon:'none'})},
    });
  },
});
