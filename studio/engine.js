/* PhySoc Studio engine — vanilla JS */
(function(){
  "use strict";
  var TPL = window.PHYSOC_TEMPLATES || [];
  var $ = function(s,r){return (r||document).querySelector(s);};
  var stage = $("#stageScaler"), gallery = $("#gallery"), editor = $("#editor");
  var pBody = $("#pBody"), pName = $("#pName"), pDim = $("#pDim");
  var fileInput = $("#fileInput"), toastEl = $("#toast"), issuesEl = $("#issues"), draftState = $("#draftState");
  var current = null, root = null, stageScale = 1, dirty = false, pendingDraft = null;
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
  function draftKey(){ return current ? "physoc-studio:draft:"+slugify(current.name) : ""; }
  function markDirty(){
    if(!current) return;
    dirty=true; draftState.textContent="Draft saved";
    clearTimeout(markDirty._t); markDirty._t=setTimeout(saveDraft,250);
    clearTimeout(markDirty._v); markDirty._v=setTimeout(showIssues,120);
  }
  function draftData(){
    var fields={};
    root.querySelectorAll("[data-field][data-fkey]").forEach(function(el){ fields[el.getAttribute("data-fkey")]=el.textContent; });
    return {
      fields:fields,
      schedule:waEvents ? waEvents.map(function(ev){ return {day:ev.day,title:ev.title,meta:ev.meta,cat:ev.cat}; }) : null,
      rowCats:[].map.call(root.querySelectorAll("[data-catrow]"),function(row){return row.getAttribute("data-cat")||"social";}),
      photos:[].map.call(root.querySelectorAll("[data-photo]"),function(slot){var st=photoState.get(slot); return st&&st.url?{url:st.url,zoom:st.zoom,tx:st.tx,ty:st.ty}:null;})
    };
  }
  function saveDraft(){
    if(!dirty||!current||!root) return;
    var data=draftData();
    try{ localStorage.setItem(draftKey(),JSON.stringify(data)); }
    catch(err){
      data.photos=[];
      try{ localStorage.setItem(draftKey(),JSON.stringify(data)); toast("Draft saved without photos"); }
      catch(ignore){ draftState.textContent="Draft could not save"; }
    }
  }
  function applyDraftFields(data){
    if(!data||!data.fields) return;
    root.querySelectorAll("[data-field][data-fkey]").forEach(function(el){ var key=el.getAttribute("data-fkey"); if(Object.prototype.hasOwnProperty.call(data.fields,key)) el.textContent=data.fields[key]; });
  }
  function clearDraft(){ if(current) localStorage.removeItem(draftKey()); pendingDraft=null; dirty=false; draftState.textContent=""; }
  function confirmLeave(){ return !dirty || window.confirm("Leave this template? Your local draft will stay available."); }

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
        var card=document.createElement("button"); card.type="button"; card.className="card"; card.setAttribute("aria-label","Edit "+t.name+", "+t.w+" by "+t.h+" pixels");
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
    var aw=Math.max(40,wrap.clientWidth-pad), ah=Math.max(40,wrap.clientHeight-pad);
    stageScale=Math.max(0.04,Math.min(aw/current.w, ah/current.h));
    stage.style.width=current.w+"px"; stage.style.height=current.h+"px";
    stage.style.transformOrigin="center center";
    stage.style.transform="scale("+stageScale+")";
  }

  function openEditor(t){
    current=t;
    waEvents=null; waList=null; waMonthEl=null;
    stage.innerHTML=t.html;
    root=stage.firstElementChild;
    root.id="export-root";
    pendingDraft=null;
    try{ pendingDraft=JSON.parse(localStorage.getItem(draftKey())||"null"); }catch(ignore){}
    applyDraftFields(pendingDraft);
    pName.textContent=t.name; pDim.textContent=t.w+" × "+t.h+" px";
    photoState=new Map();
    gallery.style.display="none"; editor.classList.add("on");
    $("#backBtn").style.display=""; $("#dlBtn").style.display="none";
    fitStage();
    buildPanel();
    dirty=!!pendingDraft; draftState.textContent=dirty?"Draft recovered":"";
    showIssues();
    if(dirty) toast("Local draft recovered");
    window.scrollTo(0,0);
  }
  function closeEditor(){
    if(!confirmLeave()) return;
    saveDraft();
    editor.classList.remove("on"); gallery.style.display="";
    $("#backBtn").style.display="none";
    current=null; root=null; dirty=false; draftState.textContent=""; issuesEl.classList.remove("on");
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
      slots.forEach(function(slot,i){ setupSlot(slot,i); ps.appendChild(photoCard(slot,i)); });
      pBody.appendChild(ps);
    }
    // CATEGORIES (badge + standalone rows only — schedule rows handled above)
    if(!schedule){
      var rows=[].slice.call(root.querySelectorAll("[data-catrow]"));
      if(pendingDraft&&pendingDraft.rowCats) rows.forEach(function(row,i){ if(pendingDraft.rowCats[i]) applyRowCat(row,pendingDraft.rowCats[i]); });
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
    if(el.hasAttribute("data-multiline")){ input=document.createElement("textarea"); }
    else { input=document.createElement("input"); input.type="text"; }
    input.value=initial;
    el.setAttribute("contenteditable","true"); el.setAttribute("spellcheck","false");
    var lock=false;
    input.addEventListener("input", function(){ lock=true; el.textContent=input.value; lock=false; markDirty(); });
    el.addEventListener("input", function(){ if(!lock) input.value=el.textContent; markDirty(); });
    el.addEventListener("blur", function(){ input.value=el.textContent; });
    wrap.appendChild(input);
    return wrap;
  }

  /* ---------------- photos ---------------- */
  function setupSlot(slot,i){
    var saved=pendingDraft&&pendingDraft.photos&&pendingDraft.photos[i];
    photoState.set(slot,saved?{url:saved.url,zoom:saved.zoom||1,tx:saved.tx||0,ty:saved.ty||0}:{url:null,zoom:1,tx:0,ty:0});
    slot.classList.add("empty");
    slot.tabIndex=0; slot.setAttribute("role","button"); slot.setAttribute("aria-label","Upload photo "+(i+1));
    slot.innerHTML='<div class="photo-ph"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.6"/><path d="M21 17l-5-5-4 4-2-2-4 4"/></svg><span>Add photo</span></div>';
    slot.addEventListener("click", function(e){ var st=photoState.get(slot); if(!st.url){ pendingSlot=slot; fileInput.value=""; fileInput.click(); } });
    slot.addEventListener("keydown",function(e){if((e.key==="Enter"||e.key===" ")&&!photoState.get(slot).url){e.preventDefault();pendingSlot=slot;fileInput.value="";fileInput.click();}});
    // drag to reposition
    var dragging=false, lastX=0, lastY=0;
    slot.addEventListener("pointerdown", function(e){ var st=photoState.get(slot); if(!st.url) return; dragging=true; lastX=e.clientX; lastY=e.clientY; slot.classList.add("dragging"); slot.setPointerCapture(e.pointerId); e.preventDefault(); });
    slot.addEventListener("pointermove", function(e){ if(!dragging) return; var st=photoState.get(slot);
      var dx=(e.clientX-lastX)/stageScale, dy=(e.clientY-lastY)/stageScale; lastX=e.clientX; lastY=e.clientY;
      var w=slot.offsetWidth||1, h=slot.offsetHeight||1;
      st.tx += dx/w*100; st.ty += dy/h*100;
      clampPan(st); applyPhoto(slot); markDirty();
    });
    function end(e){ if(dragging){ dragging=false; slot.classList.remove("dragging"); } }
    slot.addEventListener("pointerup", end); slot.addEventListener("pointercancel", end);
    if(saved) setImage(slot,saved.url,saved);
  }
  function clampPan(st){ st.tx=Math.max(-50,Math.min(50,st.tx)); st.ty=Math.max(-50,Math.min(50,st.ty)); }
  function applyPhoto(slot){
    var st=photoState.get(slot); var img=slot.querySelector("img.uimg"); if(!img) return;
    img.style.objectPosition=(50+st.tx)+"% "+(50+st.ty)+"%";
    img.style.transform="scale("+st.zoom+")";
  }
  function setImage(slot,url,saved){
    var st=photoState.get(slot); st.url=url;
    if(!saved){ st.zoom=1; st.tx=0; st.ty=0; }
    slot.classList.remove("empty");
    slot.setAttribute("aria-label","Reposition photo");
    slot.innerHTML='<img class="uimg" alt="" src="'+url+'" style="width:100%;height:100%;object-fit:cover;display:block;transform-origin:center center">';
    applyPhoto(slot);
  }
  fileInput.addEventListener("change", function(){
    var f=fileInput.files && fileInput.files[0]; if(!f||!pendingSlot) return;
    var slot=pendingSlot; pendingSlot=null;
    var r=new FileReader(); r.onload=function(){ setImage(slot, r.result); refreshPhotoCard(slot); markDirty(); }; r.readAsDataURL(f);
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
        rng.setAttribute("aria-label","Photo "+(i+1)+" zoom");
        rng.addEventListener("input", function(){ st.zoom=(+rng.value)/100; clampPan(st); applyPhoto(slot); markDirty(); });
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
    sel.addEventListener("change", function(){ applyRowCat(row, sel.value); markDirty(); });
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
    var cur=(badge.textContent||"").trim().toLowerCase();
    var lab=document.createElement("label"); lab.textContent=badge.getAttribute("data-label")||"Badge label"; wrap.appendChild(lab);
    if(BADGE_CATS.indexOf(cur)<0){
      var input=document.createElement("input"); input.type="text"; input.value=badge.textContent.trim();
      input.addEventListener("input",function(){badge.textContent=input.value;markDirty();}); wrap.appendChild(input); return wrap;
    }
    var sel=document.createElement("select");
    var opts=BADGE_CATS.slice();
    opts.forEach(function(c){ var o=document.createElement("option"); o.value=c; o.textContent=c.toUpperCase(); sel.appendChild(o); });
    sel.value=cur;
    sel.addEventListener("change", function(){ applyBadge(badge, sel.value); markDirty(); });
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
      k*=(avail/over)*0.995; k=Math.max(0.72,k); paint();
    }
    waList.setAttribute("data-overflow",waList.scrollHeight>waList.clientHeight+1?"true":"false");
  }
  function buildScheduleEditor(list){
    waList=list;
    waMonthEl=root.querySelector("[data-wa-month]");
    waEvents=[].slice.call(list.querySelectorAll(".event-row")).map(function(row){
      function tx(sel){ var e=row.querySelector(sel); return e?e.textContent.trim():""; }
      return { day:tx("[data-day]")||"01", title:tx("[data-title]")||"Event title", meta:tx("[data-meta]")||"Time \u00b7 Location", cat:row.getAttribute("data-cat")||"talk" };
    });
    if(pendingDraft&&pendingDraft.schedule&&pendingDraft.schedule.length) waEvents=pendingDraft.schedule;
    if(!waEvents.length) waEvents=[{day:"01",title:"Event title",meta:"Time \u00b7 Location",cat:"social"}];
    if(waMonthEl && !waMonthEl._waHook){ waMonthEl._waHook=true; waMonthEl.addEventListener("input", function(){ renderSchedule(); }); }
    renderSchedule();
    var sec=section("Events"); var host=document.createElement("div"); sec.appendChild(host);
    function rebuild(){
      host.innerHTML="";
      waEvents.forEach(function(ev,i){ host.appendChild(eventCard(ev,i,rebuild)); });
      var limit=current.h>=1900?5:4;
      var add=document.createElement("button"); add.type="button"; add.className="btn"; add.style.cssText="width:100%;justify-content:center;margin-top:2px";
      add.textContent=waEvents.length>=limit?"Event limit reached":"+ Add event"; add.disabled=waEvents.length>=limit;
      add.addEventListener("click", function(){ if(waEvents.length>=limit)return; waEvents.push({day:pad2(waEvents.length+1),title:"Event title",meta:"Time \u00b7 Location",cat:"talk"}); renderSchedule(); rebuild(); markDirty(); });
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
    var rm=document.createElement("button"); rm.type="button"; rm.className="btn"; rm.style.cssText="padding:4px 11px;font-size:13px"; rm.textContent="\u2715"; rm.title="Remove event"; rm.setAttribute("aria-label","Remove event "+(i+1));
    if(waEvents.length<=1) rm.disabled=true;
    rm.addEventListener("click", function(){ if(waEvents.length<=1) return; waEvents.splice(i,1); renderSchedule(); rebuild(); markDirty(); });
    hr.appendChild(rm); card.appendChild(hr);
    card.appendChild(waField("Title",ev.title,function(v){ ev.title=v; renderSchedule(); }));
    card.appendChild(waField("Time \u00b7 location",ev.meta,function(v){ ev.meta=v; renderSchedule(); }));
    var dr=document.createElement("div"); dr.style.cssText="display:flex;gap:8px";
    var dayW=waField("Day",ev.day,function(v){ ev.day=v; renderSchedule(); }); dayW.style.flex="0 0 78px"; dr.appendChild(dayW);
    var cw=document.createElement("div"); cw.className="fld"; cw.style.cssText="flex:1;margin:0";
    var cl=document.createElement("label"); cl.textContent="Category"; cw.appendChild(cl);
    var sel=document.createElement("select");
    ROW_CATS.forEach(function(c){ var o=document.createElement("option"); o.value=c; o.textContent=c.charAt(0).toUpperCase()+c.slice(1); sel.appendChild(o); });
    sel.value=ev.cat; sel.addEventListener("change", function(){ ev.cat=sel.value; renderSchedule(); markDirty(); });
    cw.appendChild(sel); dr.appendChild(cw); card.appendChild(dr);
    return card;
  }
  function waField(labelText,value,onInput){
    var w=document.createElement("div"); w.className="fld"; w.style.margin="0 0 8px";
    var l=document.createElement("label"); l.textContent=labelText; w.appendChild(l);
    var inp=document.createElement("input"); inp.type="text"; inp.value=value;
    inp.addEventListener("input", function(){ onInput(inp.value); markDirty(); });
    w.appendChild(inp); return w;
  }

  /* ---------------- validation and export ---------------- */
  function isClipped(el,rootRect){
    var r=el.getBoundingClientRect();
    if(r.left<rootRect.left-1||r.top<rootRect.top-1||r.right>rootRect.right+1||r.bottom>rootRect.bottom+1) return true;
    for(var p=el.parentElement;p&&p!==root;p=p.parentElement){
      var css=getComputedStyle(p), pr=p.getBoundingClientRect();
      if((css.overflowX!=="visible"&&(r.left<pr.left-1||r.right>pr.right+1))||(css.overflowY!=="visible"&&(r.top<pr.top-1||r.bottom>pr.bottom+1))) return true;
    }
    return false;
  }
  function preflight(){
    if(!root) return ["No template is open."];
    root.querySelectorAll(".has-overflow").forEach(function(el){el.classList.remove("has-overflow");});
    var problems=[], prev=stage.style.transform; stage.style.transform="none";
    var rr=root.getBoundingClientRect();
    root.querySelectorAll("[data-field]").forEach(function(el){
      if(!el.textContent.trim()){ problems.push((el.getAttribute("data-label")||"A text field")+" is empty."); el.classList.add("has-overflow"); }
      else if(isClipped(el,rr)){ problems.push((el.getAttribute("data-label")||"Text")+" is outside its safe area."); el.classList.add("has-overflow"); }
    });
    var missing=root.querySelectorAll("[data-photo].empty").length;
    if(missing) problems.push(missing+" photo "+(missing===1?"slot is":"slots are")+" empty.");
    var schedule=root.querySelector("[data-schedule-list]");
    if(schedule&&schedule.getAttribute("data-overflow")==="true"){ problems.push("The schedule is too tall. Shorten an event or remove one."); schedule.classList.add("has-overflow"); }
    var safe=root.querySelector("[data-story-safe]");
    if(safe){ var safeCss=getComputedStyle(safe); if(parseFloat(safeCss.paddingTop)<220||parseFloat(safeCss.paddingBottom)<220){ problems.push("Story content crosses the 220 px interface safe zone."); safe.classList.add("has-overflow"); } }
    stage.style.transform=prev;
    return problems.filter(function(v,i,a){return a.indexOf(v)===i;});
  }
  function showIssues(){
    if(!root) return;
    var problems=preflight();
    issuesEl.textContent=problems.length?problems.join(" "):"";
    issuesEl.classList.toggle("on",problems.length>0);
  }
  function exportHtml(){
    var clone=root.cloneNode(true);
    clone.querySelectorAll("[contenteditable]").forEach(function(el){el.removeAttribute("contenteditable");el.removeAttribute("spellcheck");});
    clone.querySelectorAll(".has-overflow").forEach(function(el){el.classList.remove("has-overflow");});
    var css=[].map.call(document.querySelectorAll("style"),function(el){return el.textContent;}).join("\n");
    var base=location.origin+location.pathname.replace(/[^/]*$/,"");
    var origin=location.origin;
    return '<!doctype html><html><head><meta charset="utf-8"><base href="'+base+'"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data: blob:; style-src \'unsafe-inline\' '+origin+'; font-src '+origin+'"><link rel="stylesheet" href="fonts/fonts.css"><style>html,body{margin:0;width:'+current.w+'px;height:'+current.h+'px;overflow:hidden}'+css+'</style></head><body>'+clone.outerHTML+'</body></html>';
  }
  async function download(){
    if(!current||!root) return;
    var problems=preflight(); showIssues();
    if(problems.length){ toast("Fix the highlighted export issues"); return; }
    var buttons=[$("#dlBtn"),$("#dlBtn2")]; buttons.forEach(function(b){b.disabled=true;});
    toast("Rendering in Chromium…"); stage.classList.add("exporting");
    try{
      if(document.fonts) await document.fonts.ready;
      var response=await fetch("api/export",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name:current.name,width:current.w,height:current.h,html:exportHtml()})});
      if(!response.ok) throw new Error((await response.text())||("Export failed with "+response.status));
      var blob=await response.blob(), bytes=new Uint8Array(await blob.arrayBuffer());
      if(bytes.length<24||bytes[0]!==137||bytes[1]!==80||bytes[2]!==78||bytes[3]!==71) throw new Error("Export service did not return a PNG");
      var view=new DataView(bytes.buffer); if(view.getUint32(16)!==current.w||view.getUint32(20)!==current.h) throw new Error("Export dimensions are incorrect");
      var url=URL.createObjectURL(blob), a=document.createElement("a"); a.href=url; a.download=slugify(current.name)+".png"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){URL.revokeObjectURL(url);},1000);
      toast("PNG downloaded");
    }catch(err){ console.error(err); toast(err.message||"Export failed"); }
    finally{ stage.classList.remove("exporting"); buttons.forEach(function(b){b.disabled=false;}); }
  }

  /* ---------------- wire ---------------- */
  $("#backBtn").addEventListener("click", closeEditor);
  $("#dlBtn").addEventListener("click", download);
  $("#dlBtn2").addEventListener("click", download);
  $("#resetBtn").addEventListener("click", function(){ if(current&&(!dirty||window.confirm("Reset this template and delete its local draft?"))){ var t=current; clearDraft(); openEditor(t); } });
  window.addEventListener("resize", function(){ if(current) fitStage(); });
  window.addEventListener("beforeunload",function(e){if(dirty){saveDraft();e.preventDefault();e.returnValue="";}});
  document.addEventListener("keydown",function(e){if(e.key==="Escape"&&current)closeEditor();});
  window.PHYSOC_STUDIO={templates:TPL,openTemplate:function(name){var t=TPL.find(function(item){return item.name===name;});if(t)openEditor(t);},preflight:preflight,exportHtml:exportHtml};

  buildGallery();
})();
