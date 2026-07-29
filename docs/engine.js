/* PhySoc Studio engine — vanilla JS */
(function(){
  "use strict";
  var TPL = window.PHYSOC_TEMPLATES || [];
  var $ = function(s,r){return (r||document).querySelector(s);};
  var stage = $("#stageScaler"), gallery = $("#gallery"), editor = $("#editor");
  var pBody = $("#pBody"), pName = $("#pName"), pDim = $("#pDim");
  var fileInput = $("#fileInput"), toastEl = $("#toast");
  var current = null, root = null, stageScale = 1;
  var photoState = new Map();     // slot -> {url,zoom,tx,ty}
  var pendingSlot = null;

  var CAT = {
    social:  {solid:"#BFF36A", on:"#0A140C", bg:"rgba(191,243,106,0.16)", bd:"rgba(191,243,106,0.38)", darkText:"#BFF36A"},
    talk:    {solid:"#5AD1A0", on:"#0A140C", bg:"rgba(90,209,160,0.16)",  bd:"rgba(90,209,160,0.38)",  darkText:"#5AD1A0"},
    workshop:{solid:"#8BC34A", on:"#0A140C", bg:"rgba(139,195,74,0.16)",  bd:"rgba(139,195,74,0.38)",  darkText:"#A8DD6B"},
    careers: {solid:"#2E7D32", on:"#FAFAFA", bg:"rgba(46,125,50,0.28)",   bd:"rgba(46,125,50,0.5)",    darkText:"#BFF36A"}
  };
  var ROW_CATS = ["social","talk","workshop","careers"];
  var BADGE_CATS = ["social","talk","workshop","careers","seminar","photos","recap"];

  function toast(msg){ toastEl.textContent=msg; toastEl.classList.add("show"); clearTimeout(toast._t); toast._t=setTimeout(function(){toastEl.classList.remove("show");},2200); }
  function slugify(s){ return s.toLowerCase().replace(/[^\w]+/g,"-").replace(/^-+|-+$/g,""); }

  /* ---------------- gallery ---------------- */
  function buildGallery(){
    var groups = {};
    TPL.forEach(function(t){ (groups[t.group]=groups[t.group]||[]).push(t); });
    var order = ["Feed posts","Stories"];
    var host = $("#groups"); host.innerHTML="";
    order.forEach(function(g){
      if(!groups[g]) return;
      var h=document.createElement("div"); h.className="grp-title"; h.textContent=g; host.appendChild(h);
      var grid=document.createElement("div"); grid.className="cards";
      groups[g].forEach(function(t){
        var card=document.createElement("div"); card.className="card";
        var thumb=document.createElement("div"); thumb.className="thumb";
        var frame=document.createElement("div"); frame.className="frame"; frame.innerHTML=t.html;
        frame.style.width=t.w+"px"; frame.style.height=t.h+"px";
        thumb.appendChild(frame);
        var meta=document.createElement("div"); meta.className="meta";
        meta.innerHTML='<span class="nm"></span><span class="dim">'+t.w+'×'+t.h+'</span>';
        meta.querySelector(".nm").textContent=t.name;
        card.appendChild(thumb); card.appendChild(meta);
        card.addEventListener("click", function(){ openEditor(t); });
        grid.appendChild(card);
        requestAnimationFrame(function(){
          var w=thumb.clientWidth||220, sc=w/t.w;
          frame.style.transform="scale("+sc+")";
          thumb.style.height=Math.round(t.h*sc)+"px";
        });
      });
      host.appendChild(grid);
    });
  }

  /* ---------------- editor ---------------- */
  function fitStage(){
    if(!current) return;
    var wrap=$(".stagewrap"), pad=68;
    var aw=wrap.clientWidth-pad, ah=wrap.clientHeight-pad;
    stageScale=Math.min(aw/current.w, ah/current.h);
    stage.style.width=current.w+"px"; stage.style.height=current.h+"px";
    stage.style.transformOrigin="center center";
    stage.style.transform="scale("+stageScale+")";
  }

  function openEditor(t){
    current=t;
    stage.innerHTML=t.html;
    root=stage.firstElementChild;
    pName.textContent=t.name; pDim.textContent=t.w+" × "+t.h+" px";
    photoState=new Map();
    gallery.style.display="none"; editor.classList.add("on");
    $("#backBtn").style.display=""; $("#dlBtn").style.display="none";
    fitStage();
    buildPanel();
    window.scrollTo(0,0);
  }
  function closeEditor(){
    editor.classList.remove("on"); gallery.style.display="";
    $("#backBtn").style.display="none";
    current=null; root=null;
  }

  /* ---------------- panel ---------------- */
  function buildPanel(){
    pBody.innerHTML="";
    var schedule=root.querySelector("[data-schedule-list]");
    // TEXT fields (exclude category tags and anything inside a schedule list)
    var fields=[].slice.call(root.querySelectorAll("[data-field]")).filter(function(el){
      if(el.hasAttribute("data-cattag")||el.hasAttribute("data-catbadge")) return false;
      if(schedule && schedule.contains(el)) return false;
      return true;
    });
    if(fields.length){
      var sec=section(schedule?"Details":"Text");
      fields.forEach(function(el){ sec.appendChild(textField(el)); });
      pBody.appendChild(sec);
    }
    // SCHEDULE (What's On) — event-by-event editor with add / remove
    if(schedule){ buildScheduleEditor(schedule); }
    // PHOTOS
    var slots=[].slice.call(root.querySelectorAll("[data-photo]"));
    if(slots.length){
      var ps=section("Photos");
      slots.forEach(function(slot,i){ setupSlot(slot); ps.appendChild(photoCard(slot,i)); });
      pBody.appendChild(ps);
    }
    // CATEGORIES (badge + standalone rows only — schedule rows handled above)
    if(!schedule){
      var rows=[].slice.call(root.querySelectorAll("[data-catrow]"));
      var badge=root.querySelector("[data-catbadge]");
      if(rows.length || badge){
        var cs=section("Category");
        if(badge) cs.appendChild(badgeControl(badge));
        rows.forEach(function(row,i){ cs.appendChild(rowControl(row,i)); });
        pBody.appendChild(cs);
      }
    }
  }
  function section(title){ var s=document.createElement("div"); s.className="sec"; var h=document.createElement("div"); h.className="sec-h"; h.textContent=title; s.appendChild(h); return s; }

  function textField(el){
    var wrap=document.createElement("div"); wrap.className="fld";
    var lab=document.createElement("label"); lab.textContent=el.getAttribute("data-label")||"Text"; wrap.appendChild(lab);
    var initial=el.textContent;
    var input;
    if(initial.length>30){ input=document.createElement("textarea"); }
    else { input=document.createElement("input"); input.type="text"; }
    input.value=initial;
    el.setAttribute("contenteditable","true"); el.setAttribute("spellcheck","false");
    var lock=false;
    input.addEventListener("input", function(){ lock=true; el.textContent=input.value; lock=false; });
    el.addEventListener("input", function(){ if(!lock) input.value=el.textContent; });
    el.addEventListener("blur", function(){ input.value=el.textContent; });
    wrap.appendChild(input);
    return wrap;
  }

  /* ---------------- photos ---------------- */
  function setupSlot(slot){
    photoState.set(slot,{url:null,zoom:1,tx:0,ty:0});
    slot.classList.add("empty");
    slot.innerHTML='<div class="photo-ph"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.6"/><path d="M21 17l-5-5-4 4-2-2-4 4"/></svg><span>Add photo</span></div>';
    slot.addEventListener("click", function(e){ var st=photoState.get(slot); if(!st.url){ pendingSlot=slot; fileInput.value=""; fileInput.click(); } });
    // drag to reposition
    var dragging=false, lastX=0, lastY=0;
    slot.addEventListener("pointerdown", function(e){ var st=photoState.get(slot); if(!st.url) return; dragging=true; lastX=e.clientX; lastY=e.clientY; slot.classList.add("dragging"); slot.setPointerCapture(e.pointerId); e.preventDefault(); });
    slot.addEventListener("pointermove", function(e){ if(!dragging) return; var st=photoState.get(slot);
      var dx=(e.clientX-lastX)/stageScale, dy=(e.clientY-lastY)/stageScale; lastX=e.clientX; lastY=e.clientY;
      var w=slot.offsetWidth||1, h=slot.offsetHeight||1;
      st.tx += dx/(st.zoom*w)*100; st.ty += dy/(st.zoom*h)*100;
      clampPan(st); applyPhoto(slot);
    });
    function end(e){ if(dragging){ dragging=false; slot.classList.remove("dragging"); } }
    slot.addEventListener("pointerup", end); slot.addEventListener("pointercancel", end);
  }
  function clampPan(st){ var m=(st.zoom-1)*50; if(st.tx>m)st.tx=m; if(st.tx<-m)st.tx=-m; if(st.ty>m)st.ty=m; if(st.ty<-m)st.ty=-m; }
  function applyPhoto(slot){
    var st=photoState.get(slot); var img=slot.querySelector("img.uimg"); if(!img) return;
    img.style.transform="scale("+st.zoom+") translate("+st.tx+"%,"+st.ty+"%)";
  }
  function setImage(slot,url){
    var st=photoState.get(slot); st.url=url; st.zoom=1; st.tx=0; st.ty=0;
    slot.classList.remove("empty");
    slot.innerHTML='<img class="uimg" src="'+url+'" style="width:100%;height:100%;object-fit:cover;display:block;transform-origin:center center;transform:scale(1) translate(0,0)">';
    applyPhoto(slot);
  }
  fileInput.addEventListener("change", function(){
    var f=fileInput.files && fileInput.files[0]; if(!f||!pendingSlot) return;
    var slot=pendingSlot; pendingSlot=null;
    var r=new FileReader(); r.onload=function(){ setImage(slot, r.result); refreshPhotoCard(slot); }; r.readAsDataURL(f);
  });
  function photoCard(slot,i){
    var cap=""; var fig=slot.closest("figure"); if(fig){ var fc=fig.querySelector("figcaption"); if(fc) cap=fc.textContent.trim(); }
    var card=document.createElement("div"); card.className="photocard"; card._slot=slot;
    render();
    function render(){
      var st=photoState.get(slot); var has=!!st.url;
      card.innerHTML="";
      var row=document.createElement("div"); row.className="row";
      var lbl=document.createElement("label"); lbl.style.flex="1"; lbl.style.margin="0"; lbl.style.fontSize="12px"; lbl.style.color="#c3cec7";
      lbl.textContent = cap ? (cap.charAt(0).toUpperCase()+cap.slice(1)) : ("Photo "+(i+1));
      row.appendChild(lbl);
      var btn=document.createElement("button"); btn.className="btn"; btn.style.padding="6px 12px"; btn.style.fontSize="12.5px";
      btn.textContent = has ? "Replace" : "Upload";
      btn.addEventListener("click", function(){ pendingSlot=slot; fileInput.value=""; fileInput.click(); });
      row.appendChild(btn);
      card.appendChild(row);
      if(has){
        var rng=document.createElement("input"); rng.type="range"; rng.min="100"; rng.max="280"; rng.value=Math.round(st.zoom*100); rng.className="rng";
        rng.addEventListener("input", function(){ st.zoom=(+rng.value)/100; clampPan(st); applyPhoto(slot); });
        card.appendChild(rng);
        var hint=document.createElement("div"); hint.className="hint"; hint.textContent="Drag the photo to reposition · slider to zoom"; card.appendChild(hint);
      } else {
        var hint2=document.createElement("div"); hint2.className="hint"; hint2.textContent="Upload your own image."; card.appendChild(hint2);
      }
    }
    card._render=render;
    return card;
  }
  function refreshPhotoCard(slot){
    var cards=pBody.querySelectorAll(".photocard");
    for(var i=0;i<cards.length;i++){ if(cards[i]._slot===slot && cards[i]._render){ cards[i]._render(); } }
  }

  /* ---------------- categories ---------------- */
  function rowControl(row,i){
    var wrap=document.createElement("div"); wrap.className="fld";
    var titleEl=row.querySelector("[data-title]"); var nm=titleEl?titleEl.textContent.trim():("Event "+(i+1));
    var lab=document.createElement("label"); lab.textContent=nm.length>26?nm.slice(0,25)+"…":nm; wrap.appendChild(lab);
    var sel=document.createElement("select");
    ROW_CATS.forEach(function(c){ var o=document.createElement("option"); o.value=c; o.textContent=c.charAt(0).toUpperCase()+c.slice(1); sel.appendChild(o); });
    sel.value = row.getAttribute("data-cat") || "social";
    sel.addEventListener("change", function(){ applyRowCat(row, sel.value); });
    wrap.appendChild(sel);
    return wrap;
  }
  function applyRowCat(row,cat){
    var c=CAT[cat]; if(!c) return;
    row.setAttribute("data-cat",cat);
    row.style.background=c.bg; row.style.border="1px solid "+c.bd;
    var chip=row.querySelector("[data-catchip]"); if(chip){ chip.style.background=c.solid; chip.style.color=c.on; }
    var tag=row.querySelector("[data-cattag]"); if(tag){ tag.style.background=c.solid; tag.style.color=c.on; tag.textContent=cat; }
  }
  function badgeControl(badge){
    var wrap=document.createElement("div"); wrap.className="fld";
    var lab=document.createElement("label"); lab.textContent="Badge label"; wrap.appendChild(lab);
    var sel=document.createElement("select");
    var cur=(badge.textContent||"").trim().toLowerCase();
    var opts=BADGE_CATS.slice();
    if(opts.indexOf(cur)<0) opts.unshift(cur);
    opts.forEach(function(c){ var o=document.createElement("option"); o.value=c; o.textContent=c.toUpperCase(); sel.appendChild(o); });
    sel.value=cur;
    sel.addEventListener("change", function(){ applyBadge(badge, sel.value); });
    wrap.appendChild(sel);
    return wrap;
  }
  function applyBadge(badge,cat){
    badge.textContent=cat;
    var c=CAT[cat];
    if(c){ var dark=!!badge.closest('[data-register="dark"]'); badge.style.color = dark ? c.darkText : c.solid; }
  }

  /* ---------------- What's On schedule (event-by-event) ---------------- */
  var WA_METRICS={
    post:{tile:96,padV:24,padH:30,gapInner:28,dayFS:44,monthFS:16,titleFS:36,metaFS:20,tagFS:18,radius:20,trad:12,tagPadV:8,tagPadH:18,gap:22,mt4:4},
    story:{tile:108,padV:28,padH:34,gapInner:30,dayFS:50,monthFS:17,titleFS:40,metaFS:22,tagFS:20,radius:22,trad:14,tagPadV:9,tagPadH:20,gap:26,mt4:6}
  };
  var waEvents=null, waList=null, waMonthEl=null;
  function esc(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
  function pad2(n){ return (n<10?"0":"")+n; }
  function waMetrics(){ return (current && current.h>=1900) ? WA_METRICS.story : WA_METRICS.post; }
  function waAbbr(){ var t=waMonthEl?(waMonthEl.textContent||""):""; t=t.trim(); return (t?t.slice(0,3):"mon").toUpperCase(); }
  function rowHTML(ev,mo,k){
    var c=CAT[ev.cat]||CAT.talk, m=waMetrics();
    function r(x){ return Math.round(x*k); }
    return '<div class="event-row" data-catrow="" data-cat="'+esc(ev.cat)+'" style="display:flex;align-items:center;gap:'+r(m.gapInner)+'px;padding:'+r(m.padV)+'px '+r(m.padH)+'px;background:'+c.bg+';-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);border:1px solid '+c.bd+';border-radius:'+r(m.radius)+'px;box-shadow:0 12px 30px rgba(0,0,0,0.3)">'
      +'<div data-catchip="" style="flex:0 0 auto;width:'+r(m.tile)+'px;height:'+r(m.tile)+'px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:'+c.solid+';color:'+c.on+';border-radius:'+r(m.trad)+'px;line-height:1">'
      +'<span data-day="" style="font-family:\'Space Grotesk\',sans-serif;font-weight:700;font-size:'+r(m.dayFS)+'px">'+esc(ev.day)+'</span>'
      +'<span data-month="" style="font-family:\'IBM Plex Mono\',monospace;font-size:'+r(m.monthFS)+'px;letter-spacing:0.1em;text-transform:uppercase;margin-top:'+r(m.mt4)+'px">'+esc(mo)+'</span>'
      +'</div>'
      +'<div style="flex:1;min-width:0">'
      +'<div data-title="" style="font-family:\'Baloo 2\',sans-serif;font-weight:600;font-size:'+r(m.titleFS)+'px;color:#FAFAFA">'+esc(ev.title)+'</div>'
      +'<div data-meta="" style="font-family:\'IBM Plex Mono\',monospace;font-size:'+r(m.metaFS)+'px;letter-spacing:0.06em;text-transform:uppercase;color:rgba(250,250,250,0.65);margin-top:'+r(m.mt4)+'px">'+esc(ev.meta)+'</div>'
      +'</div>'
      +'<span data-cattag="" style="flex:0 0 auto;font-family:\'IBM Plex Mono\',monospace;font-size:'+r(m.tagFS)+'px;font-weight:500;letter-spacing:0.16em;text-transform:uppercase;color:'+c.on+';background:'+c.solid+';padding:'+r(m.tagPadV)+'px '+r(m.tagPadH)+'px;border-radius:999px">'+esc(ev.cat)+'</span>'
      +'</div>';
  }
  function renderSchedule(){
    if(!waList||!waEvents) return;
    // Constrain the list to its flex-allocated space so clientHeight reflects the
    // room available (min-height:auto would let it grow to content and never "overflow").
    waList.style.minHeight="0"; waList.style.overflow="hidden";
    var m=waMetrics(), mo=waAbbr(), k=1;
    function paint(){ waList.style.gap=Math.round(m.gap*k)+"px"; waList.innerHTML=waEvents.map(function(ev){ return rowHTML(ev,mo,k); }).join(""); }
    paint();
    for(var pass=0; pass<6; pass++){
      var over=waList.scrollHeight, avail=waList.clientHeight;
      if(over<=avail+1) break;
      k*=(avail/over)*0.995; k=Math.max(0.35,k); paint();
    }
  }
  function buildScheduleEditor(list){
    waList=list;
    waMonthEl=root.querySelector("[data-wa-month]");
    waEvents=[].slice.call(list.querySelectorAll(".event-row")).map(function(row){
      function tx(sel){ var e=row.querySelector(sel); return e?e.textContent.trim():""; }
      return { day:tx("[data-day]")||"01", title:tx("[data-title]")||"Event title", meta:tx("[data-meta]")||"Time \u00b7 Location", cat:row.getAttribute("data-cat")||"talk" };
    });
    if(!waEvents.length) waEvents=[{day:"01",title:"Event title",meta:"Time \u00b7 Location",cat:"social"}];
    if(waMonthEl && !waMonthEl._waHook){ waMonthEl._waHook=true; waMonthEl.addEventListener("input", function(){ renderSchedule(); }); }
    renderSchedule();
    var sec=section("Events"); var host=document.createElement("div"); sec.appendChild(host);
    function rebuild(){
      host.innerHTML="";
      waEvents.forEach(function(ev,i){ host.appendChild(eventCard(ev,i,rebuild)); });
      var add=document.createElement("button"); add.className="btn"; add.style.cssText="width:100%;justify-content:center;margin-top:2px";
      add.textContent="+ Add event";
      add.addEventListener("click", function(){ waEvents.push({day:pad2(waEvents.length+1),title:"Event title",meta:"Time \u00b7 Location",cat:"talk"}); renderSchedule(); rebuild(); });
      host.appendChild(add);
    }
    rebuild();
    pBody.appendChild(sec);
  }
  function eventCard(ev,i,rebuild){
    var card=document.createElement("div"); card.className="photocard";
    var hr=document.createElement("div"); hr.className="row"; hr.style.marginBottom="10px";
    var lbl=document.createElement("label"); lbl.style.cssText="flex:1;margin:0;font-size:12px;color:#c3cec7;font-weight:600"; lbl.textContent="Event "+(i+1);
    hr.appendChild(lbl);
    var rm=document.createElement("button"); rm.className="btn"; rm.style.cssText="padding:4px 11px;font-size:13px"; rm.textContent="\u2715"; rm.title="Remove event";
    if(waEvents.length<=1) rm.disabled=true;
    rm.addEventListener("click", function(){ if(waEvents.length<=1) return; waEvents.splice(i,1); renderSchedule(); rebuild(); });
    hr.appendChild(rm); card.appendChild(hr);
    card.appendChild(waField("Title",ev.title,function(v){ ev.title=v; renderSchedule(); }));
    card.appendChild(waField("Time \u00b7 location",ev.meta,function(v){ ev.meta=v; renderSchedule(); }));
    var dr=document.createElement("div"); dr.style.cssText="display:flex;gap:8px";
    var dayW=waField("Day",ev.day,function(v){ ev.day=v; renderSchedule(); }); dayW.style.flex="0 0 78px"; dr.appendChild(dayW);
    var cw=document.createElement("div"); cw.className="fld"; cw.style.cssText="flex:1;margin:0";
    var cl=document.createElement("label"); cl.textContent="Category"; cw.appendChild(cl);
    var sel=document.createElement("select");
    ROW_CATS.forEach(function(c){ var o=document.createElement("option"); o.value=c; o.textContent=c.charAt(0).toUpperCase()+c.slice(1); sel.appendChild(o); });
    sel.value=ev.cat; sel.addEventListener("change", function(){ ev.cat=sel.value; renderSchedule(); });
    cw.appendChild(sel); dr.appendChild(cw); card.appendChild(dr);
    return card;
  }
  function waField(labelText,value,onInput){
    var w=document.createElement("div"); w.className="fld"; w.style.margin="0 0 8px";
    var l=document.createElement("label"); l.textContent=labelText; w.appendChild(l);
    var inp=document.createElement("input"); inp.type="text"; inp.value=value;
    inp.addEventListener("input", function(){ onInput(inp.value); });
    w.appendChild(inp); return w;
  }

  /* ---------------- export ---------------- */
  function download(){
    if(!current||!root) return;
    toast("Rendering…");
    var prevT=stage.style.transform; stage.style.transform="none";
    stage.classList.add("exporting");
    (document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve()).then(function(){
      return window.htmlToImage.toPng(root,{pixelRatio:2,width:current.w,height:current.h,cacheBust:true,backgroundColor:null});
    }).then(function(url){
      stage.style.transform=prevT; stage.classList.remove("exporting");
      var a=document.createElement("a"); a.href=url; a.download=slugify(current.name)+".png"; document.body.appendChild(a); a.click(); a.remove();
      toast("Downloaded ✓");
    }).catch(function(err){
      stage.style.transform=prevT; stage.classList.remove("exporting");
      console.error(err); toast("Export failed — try again");
    });
  }

  /* ---------------- wire ---------------- */
  $("#backBtn").addEventListener("click", closeEditor);
  $("#dlBtn").addEventListener("click", download);
  $("#dlBtn2").addEventListener("click", download);
  $("#resetBtn").addEventListener("click", function(){ if(current) openEditor(current); });
  window.addEventListener("resize", function(){ if(current) fitStage(); });

  buildGallery();
})();
