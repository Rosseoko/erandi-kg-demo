(() => {
  'use strict';

  const entities = window.ERANDI_ENTITIES || [];
  const relationships = window.ERANDI_RELATIONSHIPS || [];
  const sources = window.ERANDI_SOURCES || [];
  const moves = window.ERANDI_MOVES || [];
  const moveMappings = window.ERANDI_MOVE_MAPPINGS || [];
  const development = window.ERANDI_DEVELOPMENT || [];
  const udlAdaptations = window.ERANDI_UDL_ADAPTATIONS || [];
  const evidenceIntents = window.ERANDI_EVIDENCE_INTENTS || [];
  const artifactTemplates = window.ERANDI_ARTIFACTS || [];
  const journey = window.ERANDI_BEE_JOURNEY_RAW || [];
  const pblProject = window.ERANDI_PBL_PROJECT || {};

  const entityMap = new Map(entities.map(d => [d.entity_id, d]));
  const sourceMap = new Map(sources.map(d => [d.source_id, d]));
  const moveMap = new Map(moves.map(d => [d.move_id, d]));
  const evidenceMap = new Map(evidenceIntents.map(d => [d.evidence_intent_id, d]));
  const artifactMap = new Map(artifactTemplates.map(d => [d.artifact_id, d]));

  const domainNames = { SCI:'Ciencia', ENG:'Ingeniería', MAT:'Matemática', TEC:'Tecnología/Computación', ART:'Artes/Diseño' };
  const layerNames = {L1:'Currículum',L2:'Marco STEAM',L3:'Inteligencia pedagógica',X12:'Puente Currículum–STEAM',X13:'Puente Currículum–Pedagogía',X23:'Puente STEAM–Pedagogía'};
  const provenanceLabels = {
    official_curriculum:'Oficial Mineduc', external_framework:'Marco externo', expert_synthesis:'Síntesis experta',
    expert_interpretation:'Interpretación experta', expert_application:'Aplicación experta', expert_curated:'Curación experta',
    prototype:'Prototipo Erandi', erandi_curated:'Curación Erandi'
  };
  const typeLabels = {
    curriculum_framework:'Marco curricular',grade_level:'Curso',subject:'Asignatura',subject_orientation:'Énfasis curricular',
    curriculum_axis:'Eje curricular',learning_objective:'OA',skill_architecture:'Arquitectura de habilidades',skill_stage:'Etapa de habilidad',
    skill_objective:'OAH',atomic_skill:'Habilidad atómica',attitude_objective:'OAA',canonical_concept:'Concepto',theme_phenomenon:'Tema/fenómeno',
    steam_domain:'Dominio STEAM',disciplinary_practice:'Práctica disciplinar',practice_progression_level:'Nivel de progresión',cross_cutting_competency:'Competencia transversal',
    developmental_band:'Banda de desarrollo',udl_consideration:'Consideración DUA',pedagogical_move:'Movimiento pedagógico',evidence_intent:'Intención de evidencia',support_artifact_template:'Material/plantilla'
  };
  const relLabels = {
    has_subject:'TIENE ASIGNATURA',includes_grade:'INCLUYE CURSO',has_orientation:'TIENE ÉNFASIS',has_axis:'TIENE EJE',has_learning_objective:'TIENE OA',applies_to_grade:'APLICA A',
    has_skill_architecture:'TIENE ARQUITECTURA',has_stage:'TIENE ETAPA',has_skill_objective:'TIENE OAH',uses_atomic_skill:'USA HABILIDAD',has_attitude:'TIENE ACTITUD',
    targets_concept:'APUNTA A CONCEPTO',includes_construct:'INCLUYE CONSTRUCTO',builds_towards:'CONSTRUYE HACIA',relates_to:'SE RELACIONA CON',instantiates:'INSTANCIA',
    has_practice:'TIENE PRÁCTICA',has_progression_level:'TIENE NIVEL',next_level:'SIGUIENTE NIVEL',creates_opportunity_for:'ABRE OPORTUNIDAD PARA',
    maps_to_steam_practice:'MAPEA A PRÁCTICA STEAM',affords_steam_practice:'HABILITA PRÁCTICA STEAM',can_afford_practice:'PUEDE HABILITAR PRÁCTICA',
    supports_curriculum_skill:'APOYA HABILIDAD CURRICULAR',supports_steam_practice:'APOYA PRÁCTICA STEAM',elicits_evidence_of:'ELICITA EVIDENCIA DE',
    has_developmental_adaptation:'ADAPTADO A',can_apply_udl_consideration:'PUEDE APLICAR DUA',has_evidence_intent:'TIENE INTENCIÓN DE EVIDENCIA',has_support_artifact:'TIENE MATERIAL'
  };

  const state = {
    view:'graph', preset:'bees', domain:'all', provenance:'all', selectedId:null, focusIds:null,
    scale:1, tx:0, ty:0, drag:false, lastX:0, lastY:0, visibleNodeIds:new Set(), visibleRelationships:[]
  };

  const svg = document.getElementById('knowledgeGraph');
  const NS = 'http://www.w3.org/2000/svg';
  let viewportG, edgeG, labelG, nodeG, currentPositions = new Map();

  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const splitIds = value => String(value || '').split(';').map(s=>s.trim()).filter(Boolean);
  const parseJson = raw => { try { return raw ? JSON.parse(raw) : {}; } catch { return {}; } };
  const uniq = arr => [...new Set(arr.filter(Boolean))];

  function sourceTitle(id){ return sourceMap.get(id)?.title || id || 'Sin fuente registrada'; }
  function provenanceClass(p){
    if(p === 'official_curriculum') return 'official';
    if(p === 'external_framework') return 'external';
    if((p||'').startsWith('expert')) return 'expert';
    if((p||'').includes('prototype') || (p||'').includes('erandi')) return 'prototype';
    return 'layer';
  }
  function provenanceText(p){ return provenanceLabels[p] || (p ? p.replaceAll('_',' ') : 'Sin clasificar'); }
  function verificationBadge(v){ return v && v !== 'verified' && v !== 'verified_external' ? `<span class="badge review">${esc(v.replaceAll('_',' '))}</span>` : ''; }

  function addSvg(name, attrs={}, parent=svg){
    const el = document.createElementNS(NS,name); Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v)); parent.appendChild(el); return el;
  }

  function initGraph(){
    svg.innerHTML='';
    const defs=addSvg('defs');
    let marker=addSvg('marker',{id:'arrow',viewBox:'0 0 10 10',refX:'9',refY:'5',markerWidth:'6',markerHeight:'6',orient:'auto-start-reverse'},defs);
    addSvg('path',{d:'M 0 0 L 10 5 L 0 10 z',fill:'#94a0b1'},marker);
    const filter=addSvg('filter',{id:'softShadow',x:'-20%',y:'-20%',width:'140%',height:'150%'},defs);
    addSvg('feDropShadow',{dx:'0',dy:'1','stdDeviation':'1.3','flood-opacity':'.11'},filter);
    viewportG=addSvg('g',{id:'viewport'}); edgeG=addSvg('g',{},viewportG); labelG=addSvg('g',{},viewportG); nodeG=addSvg('g',{},viewportG);
  }

  function getBeesBaseIds(){
    const ids = new Set(['cl_mineduc_bc_1_6','grade_cl_3b','subj_cn','axis_cn_life','theme_bees','oa_cn03_03','devband_middle_primary']);
    journey.forEach(s => {
      ['primary_oa','curriculum_concepts','curriculum_oah','steam_practices','pedagogical_moves','udl_design','evidence_intent','artifacts'].forEach(k => splitIds(s[k]).forEach(id=>ids.add(id)));
    });
    // Include the STEAM domain parent and selected official atomic skills without exploding all progressions.
    relationships.forEach(r => {
      if((r.relationship_type==='has_practice' && ids.has(r.target_entity_id)) ||
         (['uses_atomic_skill','has_stage','has_skill_objective','targets_concept','has_orientation'].includes(r.relationship_type) && (ids.has(r.source_entity_id)||ids.has(r.target_entity_id)))){
        ids.add(r.source_entity_id); ids.add(r.target_entity_id);
      }
    });
    return ids;
  }

  function getBeesSummaryIds(){
    const ids = new Set([
      'cl_mineduc_bc_1_6','grade_cl_3b','subj_cn','axis_cn_life','theme_bees','oa_cn03_03',
      'concept_cn_pollination','concept_cn_flowering_lifecycle','concept_cn_plant_reproduction',
      'oah_cn03_a','oah_cn03_b','oah_cn03_c','oah_cn03_d','oah_cn03_e','oah_cn03_f',
      'skill_cn_observe','skill_cn_question','skill_cn_investigate','skill_cn_use_models','skill_cn_analyze','skill_cn_communicate',
      'domain_science','domain_engineering','domain_math','domain_computing','domain_arts_design',
      'prac_sci_observation','prac_sci_questioning','prac_sci_investigation','prac_sci_data','prac_sci_modeling','prac_sci_explanation','prac_sci_argument',
      'prac_eng_define','prac_eng_criteria','prac_eng_ideate','prac_eng_modelproto','prac_eng_test','prac_eng_iterate',
      'prac_math_model','prac_math_precision','prac_math_argument',
      'prac_cs_define_problem','prac_cs_create','prac_cs_test_refine',
      'prac_art_generate','prac_art_refine','prac_art_convey','prac_art_evaluate',
      'devband_middle_primary','move_initial_model','move_stw','move_guided_investigation','move_poe','move_csq','move_model_revision','move_design_challenge','move_prototype_test_iterate','move_peer_critique','move_exit_check',
      'evid_initial_model','evid_stw','evid_guided_investigation','evid_model_revision','evid_design_challenge','evid_prototype_test_iterate',
      'udl_prior','udl_multimedia','udl_response','udl_grad_support','udl_feedback','udl_choice'
    ]);
    // Include any direct bridge nodes that connect the curated path.
    relationships.forEach(r=>{
      if(ids.has(r.source_entity_id) && ids.has(r.target_entity_id)) return;
      if(['maps_to_steam_practice','supports_curriculum_skill','supports_steam_practice','targets_concept','has_practice'].includes(r.relationship_type)){
        if(ids.has(r.source_entity_id) && entityMap.has(r.target_entity_id) && entityMap.get(r.target_entity_id).normalized_type!=='practice_progression_level') ids.add(r.target_entity_id);
        if(ids.has(r.target_entity_id) && entityMap.has(r.source_entity_id) && entityMap.get(r.source_entity_id).normalized_type!=='practice_progression_level') ids.add(r.source_entity_id);
      }
    });
    return ids;
  }

  function baseIdsForPreset(){
    if(state.focusIds) return new Set(state.focusIds);
    if(state.preset==='bees_full') return getBeesBaseIds();
    if(state.preset==='curriculum') return new Set(entities.filter(e=>e.layer==='L1').map(e=>e.entity_id));
    if(state.preset==='steam') return new Set(entities.filter(e=>e.layer==='L2' && e.normalized_type!=='practice_progression_level').map(e=>e.entity_id));
    if(state.preset==='pedagogy') return new Set(entities.filter(e=>e.layer==='L3').map(e=>e.entity_id));
    if(state.preset==='all') return new Set(entities.map(e=>e.entity_id));
    return getBeesSummaryIds();
  }

  function filteredIds(){
    let ids=baseIdsForPreset();
    if(state.domain!=='all'){
      ids = new Set([...ids].filter(id=>{
        const e=entityMap.get(id); if(!e) return false;
        if(e.layer!=='L2') return true;
        return e.domain_code===state.domain || (e.normalized_type==='steam_domain' && e.code===state.domain) || e.normalized_type==='cross_cutting_competency';
      }));
    }
    if(state.provenance!=='all') ids = new Set([...ids].filter(id=>entityMap.get(id)?.provenance_class===state.provenance));
    return ids;
  }

  function typeRank(type){
    const ranks={curriculum_framework:1,subject:2,grade_level:3,subject_orientation:4,curriculum_axis:5,learning_objective:6,skill_architecture:7,skill_stage:8,skill_objective:9,atomic_skill:10,canonical_concept:11,theme_phenomenon:12,attitude_objective:13,
      steam_domain:1,disciplinary_practice:2,practice_progression_level:3,cross_cutting_competency:4,
      developmental_band:1,pedagogical_move:2,udl_consideration:3,evidence_intent:4,support_artifact_template:5};
    return ranks[type]||20;
  }

  function layoutNodes(nodes){
    currentPositions=new Map();
    const layerXs={L1:80,L2:900,L3:1720}; const layerWidth=680; const nodeW=200,nodeH=58,gapX=18,gapY=14;
    let maxY=0;
    ['L1','L2','L3'].forEach(layer=>{
      const layerNodes=nodes.filter(n=>n.layer===layer).sort((a,b)=>typeRank(a.normalized_type)-typeRank(b.normalized_type)||String(a.name).localeCompare(String(b.name),'es'));
      const byType=new Map(); layerNodes.forEach(n=>{const k=n.normalized_type||n.local_type; if(!byType.has(k))byType.set(k,[]);byType.get(k).push(n)});
      let y=80;
      [...byType.entries()].sort((a,b)=>typeRank(a[0])-typeRank(b[0])).forEach(([type,arr])=>{
        const cols = Math.max(1,Math.min(3,Math.ceil(Math.sqrt(arr.length/1.7))));
        arr.forEach((n,i)=>{
          const c=i%cols,r=Math.floor(i/cols);
          currentPositions.set(n.entity_id,{x:layerXs[layer]+c*(nodeW+gapX),y:y+r*(nodeH+gapY),w:nodeW,h:nodeH});
        });
        y += Math.ceil(arr.length/cols)*(nodeH+gapY)+34;
      });
      maxY=Math.max(maxY,y);
    });
    return {width:2400,height:Math.max(900,maxY+70)};
  }

  function nodeFill(e){ if(e.layer==='L1')return '#e8f2ff'; if(e.layer==='L2')return '#f0e9ff'; return '#e6f6ef'; }
  function nodeStroke(e){ const p=provenanceClass(e.provenance_class); return p==='official'?'#3d73c8':p==='external'?'#7351bd':p==='expert'?'#c67a29':p==='prototype'?'#3a8b6b':'#8190a5'; }
  function wrapText(text,max=27){ const words=String(text||'').split(/\s+/);const lines=[];let line='';for(const w of words){const next=(line+' '+w).trim();if(next.length>max&&line){lines.push(line);line=w}else line=next;}if(line)lines.push(line);return lines.slice(0,3); }

  function renderGraph({fit=false}={}){
    initGraph();
    const ids=filteredIds(); state.visibleNodeIds=ids;
    const nodes=[...ids].map(id=>entityMap.get(id)).filter(Boolean);
    const rels=relationships.filter(r=>ids.has(r.source_entity_id)&&ids.has(r.target_entity_id)); state.visibleRelationships=rels;
    const bounds=layoutNodes(nodes);

    rels.forEach(r=>{
      const a=currentPositions.get(r.source_entity_id), b=currentPositions.get(r.target_entity_id); if(!a||!b)return;
      const ac={x:a.x+a.w/2,y:a.y+a.h/2},bc={x:b.x+b.w/2,y:b.y+b.h/2};
      const cross=(entityMap.get(r.source_entity_id)?.layer!==entityMap.get(r.target_entity_id)?.layer) || String(r.layer||'').startsWith('X');
      const path=addSvg('path',{class:`edge ${cross?'cross':''}`,'data-rel':r.relationship_id},edgeG);
      const mx=(ac.x+bc.x)/2; const bend=Math.min(90,Math.abs(bc.x-ac.x)*.09)*(ac.y<bc.y?1:-1);
      path.setAttribute('d',`M ${ac.x} ${ac.y} Q ${mx} ${(ac.y+bc.y)/2+bend} ${bc.x} ${bc.y}`);
      const label=addSvg('text',{x:mx,y:(ac.y+bc.y)/2+bend/2,class:'edge-label hidden-label','data-rel-label':r.relationship_id},labelG);label.textContent=relLabels[r.relationship_type]||r.relationship_type.replaceAll('_',' ');
    });

    nodes.forEach(e=>{
      const p=currentPositions.get(e.entity_id); if(!p)return;
      const g=addSvg('g',{class:'node','data-id':e.entity_id,tabindex:'0'},nodeG);
      addSvg('rect',{x:p.x,y:p.y,width:p.w,height:p.h,rx:'10',fill:nodeFill(e),stroke:nodeStroke(e)},g);
      const t=addSvg('text',{x:p.x+10,y:p.y+16,class:'node-type'},g); t.textContent=(typeLabels[e.normalized_type]||e.local_type||e.normalized_type||'NODO').toUpperCase();
      const title=addSvg('text',{x:p.x+10,y:p.y+33,class:'node-title'},g); wrapText(e.name,28).forEach((line,i)=>{const sp=addSvg('tspan',{x:p.x+10,dy:i===0?0:13},title);sp.textContent=line;});
      g.addEventListener('click',ev=>{ev.stopPropagation();selectNode(e.entity_id)});
      g.addEventListener('dblclick',ev=>{ev.stopPropagation();focusNode(e.entity_id)});
      g.addEventListener('keydown',ev=>{if(ev.key==='Enter')selectNode(e.entity_id)});
    });

    svg.setAttribute('viewBox',`0 0 ${bounds.width} ${bounds.height}`);
    applyTransform();
    if(fit) fitToScreen();
    $('graphStatus').textContent=`${nodes.length} nodos · ${rels.length} relaciones · ${state.preset==='bees'?'ruta vertical Abejas':state.preset}`;
    if(state.selectedId && ids.has(state.selectedId)) highlightSelection(state.selectedId); else clearSelectionRibbon();
  }

  function applyTransform(){ if(viewportG)viewportG.setAttribute('transform',`translate(${state.tx} ${state.ty}) scale(${state.scale})`); }
  function zoom(factor,cx=null,cy=null){
    const old=state.scale; state.scale=Math.max(.25,Math.min(4,old*factor));
    if(cx!=null&&cy!=null){state.tx=cx-(cx-state.tx)*(state.scale/old);state.ty=cy-(cy-state.ty)*(state.scale/old);} applyTransform();
  }
  function fitToScreen(){ state.scale=1;state.tx=0;state.ty=0;applyTransform(); }

  function selectNode(id){ state.selectedId=id; updateSelectedRibbon(id); highlightSelection(id); }
  function highlightSelection(id){
    const connected=new Set([id]); const related=new Set();
    state.visibleRelationships.forEach(r=>{if(r.source_entity_id===id||r.target_entity_id===id){connected.add(r.source_entity_id);connected.add(r.target_entity_id);related.add(r.relationship_id)}});
    svg.querySelectorAll('.node').forEach(n=>{const nid=n.dataset.id;n.classList.toggle('selected',nid===id);n.classList.toggle('neighbor',nid!==id&&connected.has(nid));n.classList.toggle('dimmed',!connected.has(nid));});
    svg.querySelectorAll('.edge').forEach(e=>{const on=related.has(e.dataset.rel);e.classList.toggle('highlighted',on);e.classList.toggle('dimmed',!on)});
    svg.querySelectorAll('.edge-label').forEach(l=>l.classList.toggle('hidden-label',!related.has(l.dataset.relLabel)));
  }
  function clearHighlights(){svg.querySelectorAll('.node').forEach(n=>n.classList.remove('selected','neighbor','dimmed'));svg.querySelectorAll('.edge').forEach(e=>e.classList.remove('highlighted','dimmed'));svg.querySelectorAll('.edge-label').forEach(l=>l.classList.add('hidden-label'))}

  function updateSelectedRibbon(id){
    const e=entityMap.get(id); if(!e)return;
    $('selectedType').textContent=typeLabels[e.normalized_type]||e.local_type||e.normalized_type||'Nodo';
    $('selectedName').textContent=e.name;
    $('selectedSummary').textContent=e.description || 'Sin descripción adicional.';
    $('selectedMeta').innerHTML=`<span class="badge ${provenanceClass(e.provenance_class)}">${esc(provenanceText(e.provenance_class))}</span>${verificationBadge(e.verification_status)}<span class="badge layer">${esc(e.code||e.entity_id)}</span>`;
    ['focusSelected','copySelectedId','openSelectedDetails'].forEach(x=>$(x).disabled=false);
  }
  function clearSelectionRibbon(){state.selectedId=null;clearHighlights();$('selectedType').textContent='NODO SELECCIONADO';$('selectedName').textContent='Selecciona un nodo para revisar su definición y relaciones.';$('selectedSummary').textContent='Las etiquetas de relación aparecen al seleccionar un nodo. Doble clic para enfocar su vecindario.';$('selectedMeta').innerHTML='';['focusSelected','copySelectedId','openSelectedDetails'].forEach(x=>$(x).disabled=true)}

  function focusNode(id){
    const set=new Set([id]); relationships.forEach(r=>{if(r.source_entity_id===id||r.target_entity_id===id){set.add(r.source_entity_id);set.add(r.target_entity_id)}});
    state.focusIds=set; state.preset='focus'; ensureFocusOption(); renderGraph({fit:true}); selectNode(id);
  }
  function ensureFocusOption(){ const s=$('presetSelect'); let o=s.querySelector('option[value="focus"]'); if(!o){o=document.createElement('option');o.value='focus';o.textContent='Enfoque seleccionado';s.appendChild(o)}s.value='focus'; }

  function relationRowsFor(id){ return relationships.filter(r=>r.source_entity_id===id||r.target_entity_id===id); }
  function openDetails(id){
    const e=entityMap.get(id); if(!e)return;
    const src=sourceMap.get(e.source_id); const props=parseJson(e.properties_json);
    const rels=relationRowsFor(id).slice(0,60);
    const propsHtml=Object.keys(props).length?Object.entries(props).map(([k,v])=>`<div class="detail-item"><label>${esc(k)}</label><div>${esc(typeof v==='object'?JSON.stringify(v):v)}</div></div>`).join(''):'';
    $('modalContent').innerHTML=`
      <div class="eyebrow">${esc(typeLabels[e.normalized_type]||e.local_type||e.normalized_type||'Nodo')}</div>
      <h2 id="modalTitle">${esc(e.name)}</h2>
      <div class="chip-wrap"><span class="badge ${provenanceClass(e.provenance_class)}">${esc(provenanceText(e.provenance_class))}</span>${verificationBadge(e.verification_status)}<span class="badge layer">${esc(layerNames[e.layer]||e.layer)}</span></div>
      <p>${esc(e.description||'Sin descripción.')}</p>
      <div class="detail-grid">
        <div class="detail-item"><label>ID de referencia</label><div>${esc(e.entity_id)}</div></div>
        <div class="detail-item"><label>Código</label><div>${esc(e.code||'—')}</div></div>
        <div class="detail-item"><label>Fuente primaria</label><div>${esc(sourceTitle(e.source_id))}</div></div>
        <div class="detail-item"><label>Estado de verificación</label><div>${esc(e.verification_status||'—')}</div></div>
        ${propsHtml}
      </div>
      ${src?`<h3>Fuente</h3><p><strong>${esc(src.title)}</strong><br>${esc(src.publisher||'')} · ${esc(src.normative_role||src.source_type||'')}${src.url_or_ref?`<br><a href="${esc(src.url_or_ref)}" target="_blank" rel="noreferrer">Abrir referencia ↗</a>`:''}</p>`:''}
      <h3>Relaciones (${relationRowsFor(id).length})</h3>
      <div class="relation-list">${rels.map(r=>{const outgoing=r.source_entity_id===id;const other=entityMap.get(outgoing?r.target_entity_id:r.source_entity_id);return `<div class="relation-item"><span>${outgoing?'→':'←'}</span><span class="rel-type">${esc(relLabels[r.relationship_type]||r.relationship_type)}</span><span>${esc(other?.name||'Nodo no encontrado')} <small>(${esc(other?.entity_id||'')})</small></span></div>`}).join('')}</div>`;
    $('detailsModal').classList.remove('hidden');
  }

  function switchView(view){
    state.view=view; document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.view===view)); document.querySelectorAll('.view').forEach(v=>v.classList.remove('active')); $(`view-${view}`).classList.add('active');
    if(view==='graph') setTimeout(()=>renderGraph(),0);
  }

  function renderSteam(){
    const domains=entities.filter(e=>e.normalized_type==='steam_domain');
    $('steamFilters').innerHTML=[['all','Todos'],...Object.entries(domainNames)].map(([id,n])=>`<button class="filter-chip ${id==='all'?'active':''}" data-steam-filter="${id}">${esc(n)}</button>`).join('');
    const render=(filter='all')=>{
      $('steamDomainGrid').innerHTML=domains.filter(d=>filter==='all'||d.code===filter).map(d=>{
        const practices=entities.filter(e=>e.normalized_type==='disciplinary_practice'&&e.domain_code===d.code);
        return `<article class="domain-card"><div class="eyebrow">${esc(d.code)} · ${practices.length} prácticas</div><h3>${esc(d.name)}</h3><p>${esc(d.description||'')}</p><div class="practice-list">${practices.map(p=>{
          const levels=relationships.filter(r=>r.source_entity_id===p.entity_id&&r.relationship_type==='has_progression_level').map(r=>entityMap.get(r.target_entity_id)).filter(Boolean).sort((a,b)=>parseJson(a.properties_json).level_order-parseJson(b.properties_json).level_order);
          return `<div class="practice-row"><div class="top"><strong>${esc(p.name)}</strong><span class="badge ${provenanceClass(p.provenance_class)}">${esc(provenanceText(p.provenance_class))}</span></div><p>${esc(p.description||'')}</p>${levels.length?`<div class="progression">${levels.map(l=>`<span title="${esc(l.description||'')}">${esc(l.name)}</span>`).join('<b>→</b>')}</div><div style="margin-top:5px"><span class="badge expert">Progresión experta · revisar</span></div>`:''}</div>`
        }).join('')}</div></article>`
      }).join('');
    };
    render();
    $('steamFilters').addEventListener('click',ev=>{const b=ev.target.closest('[data-steam-filter]');if(!b)return;document.querySelectorAll('[data-steam-filter]').forEach(x=>x.classList.remove('active'));b.classList.add('active');render(b.dataset.steamFilter)});
  }

  function namesForMappings(moveId,targetType){return moveMappings.filter(m=>m.move_id===moveId&&(!targetType||m.target_type===targetType)).map(m=>entityMap.get(m.target_id)?.name||m.target_id)}
  function renderPedagogy(){
    const types=uniq(moves.map(m=>m.move_type)).sort(); $('moveTypeFilter').innerHTML='<option value="all">Todos</option>'+types.map(t=>`<option value="${esc(t)}">${esc(t.replaceAll('_',' '))}</option>`).join('');
    const render=(type='all')=>{$('moveGrid').innerHTML=moves.filter(m=>type==='all'||m.move_type===type).map(m=>{
      const dev=development.find(d=>d.move_id===m.move_id); const udls=udlAdaptations.filter(u=>u.move_id===m.move_id); const ev=evidenceIntents.find(x=>x.move_id===m.move_id); const arts=artifactTemplates.filter(a=>a.move_id===m.move_id);
      const oah=namesForMappings(m.move_id,'OAH'); const steam=moveMappings.filter(x=>x.move_id===m.move_id&&x.target_type==='STEAM_PRACTICE').map(x=>entityMap.get(x.target_id)?.name||x.target_id);
      return `<article class="move-card"><div class="move-title"><h3>${esc(m.name)}</h3><span class="move-type">${esc(m.move_type)}</span></div><p>${esc(m.description||'')}</p>
        <div class="move-section"><label>Cuándo usar</label><p>${esc(m.use_when||'—')}</p></div><div class="move-section"><label>Evitar cuando</label><p>${esc(m.avoid_when||'—')}</p></div>
        <div class="move-section"><label>Conexión curricular</label><div class="chip-wrap">${oah.map(n=>`<span class="mini-chip l1">${esc(n)}</span>`).join('')||'<span class="mini-chip">Sin mapping OAH</span>'}</div></div>
        <div class="move-section"><label>Prácticas STEAM</label><div class="chip-wrap">${steam.map(n=>`<span class="mini-chip l2">${esc(n)}</span>`).join('')||'<span class="mini-chip">Sin mapping explícito</span>'}</div></div>
        ${dev?`<div class="move-section"><label>Adaptación 3° Básico</label><p>${esc(dev.move_specific_guidance||dev.facilitation_note||dev.language_guidance)}</p></div>`:''}
        <div class="move-section"><label>DUA</label><div class="chip-wrap">${udls.map(u=>`<span class="mini-chip l3" title="${esc(u.practical_adaptation)}">${esc(entityMap.get(u.udl_consideration_id)?.name||u.udl_consideration_id)}</span>`).join('')||'<span class="mini-chip">Sin adaptación DUA</span>'}</div></div>
        ${ev?`<div class="move-section"><label>Qué observar</label><p>${esc(ev.watch_for)}</p><div class="chip-wrap"><span class="mini-chip l3">${esc(ev.name)}</span></div></div>`:''}
        <div class="move-section"><label>Materiales posibles</label><div class="chip-wrap">${uniq(arts.map(a=>a.artifact_type)).map(n=>`<span class="mini-chip">${esc(n.replaceAll('_',' '))}</span>`).join('')}</div></div>
        <div class="move-source">Fuente: ${esc(sourceTitle(m.source_id))}${m.license_status==='license_review_required'?' · ⚠ revisión de licencia':''}</div></article>`
    }).join('')}; render(); $('moveTypeFilter').addEventListener('change',e=>render(e.target.value));
  }

  function displayEntity(id){ const e=entityMap.get(id); return e?.name || id; }
  function sessionTraceIds(s){ return uniq(['primary_oa','curriculum_concepts','curriculum_oah','steam_practices','pedagogical_moves','udl_design','evidence_intent','artifacts'].flatMap(k=>splitIds(s[k]))).filter(id=>entityMap.has(id)); }
  function traceChip(id){ const e=entityMap.get(id); if(!e)return ''; const c=e.layer==='L1'?'l1':e.layer==='L2'?'l2':'l3'; return `<span class="mini-chip ${c}" title="${esc(e.entity_id)}">${esc(e.name)}</span>`; }


  function adaptedSessionTitle(s){
    if(Number(s.session)===7) return 'Preparar, criticar y revisar la comunicación';
    if(Number(s.session)===8) return 'Presentar, responder la pregunta guía y reflexionar';
    return s.title;
  }

  function adaptedSessionActivity(s){
    if(Number(s.session)===7) return 'Preparar la comunicación pública del proyecto: construir una representación clara de la polinización y de la propuesta del equipo, recibir crítica con criterios y revisar antes de presentar.';
    if(Number(s.session)===8) return 'Presentar el modelo explicativo y la propuesta a una audiencia auténtica. Responder la pregunta guía usando evidencia del proyecto y, al cierre, comparar el modelo inicial con el final para explicar qué cambió.';
    return s.activity;
  }

  function renderJourney(){
    const totalMin=journey.reduce((a,s)=>a+Number(s.duration_min||0),0);
    $('journeyHeader').innerHTML=`<div class="project-hero"><article class="project-card"><div class="eyebrow">Trayectoria de demostración · basada en el grafo</div><h2>${esc(pblProject.title)}</h2><div class="project-meta"><span class="badge prototype">${esc(pblProject.project_type)}</span><span class="badge official">${esc(pblProject.grade)}</span><span class="badge layer">${journey.length} sesiones · ${totalMin} min</span></div><p class="driving-question">${esc(pblProject.driving_question)}</p><p>${esc(pblProject.challenge)}</p></article><article class="project-card"><div class="project-summary-list"><div><label>Producto público</label><span>${esc(pblProject.public_product)}</span></div><div><label>Audiencia</label><span>${esc(pblProject.audience)}</span></div><div><label>OA principal</label><span>${esc(displayEntity('oa_cn03_03'))}</span></div><div><label>Estructura</label><span>4 fases PBL · cada sesión conserva trazabilidad a Currículum, STEAM y Pedagogía.</span></div></div></article></div>`;
    $('pblElements').innerHTML=`<section class="pbl-elements"><h3>Elementos de diseño PBL presentes en la trayectoria</h3><div class="pbl-element-grid">${pblProject.pbl_design_elements.map(x=>`<div class="pbl-element"><strong>${esc(x.name)}</strong><span>${esc(x.how)}</span></div>`).join('')}</div></section>`;
    $('journeyPhases').innerHTML=`<div class="phase-list">${pblProject.phases.map(phase=>{
      const sessions=phase.sessions.map(n=>journey.find(s=>Number(s.session)===Number(n))).filter(Boolean);
      return `<article class="phase-card"><header class="phase-header"><div class="phase-num">${phase.order}</div><div><h3>${esc(phase.name)}</h3><p>${esc(phase.description)}</p></div><span class="badge layer">${sessions.length} ${sessions.length===1?'sesión':'sesiones'}</span></header><div class="phase-sessions">${sessions.map(s=>{
        const ids=sessionTraceIds(s); const curricular=uniq(splitIds(s.primary_oa).concat(splitIds(s.curriculum_concepts),splitIds(s.curriculum_oah))).filter(id=>entityMap.has(id)); const steam=splitIds(s.steam_practices).filter(id=>entityMap.has(id)); const pedagogy=uniq(splitIds(s.pedagogical_moves).concat(splitIds(s.udl_design),splitIds(s.evidence_intent))).filter(id=>entityMap.has(id));
        const ev=splitIds(s.evidence_intent).map(id=>evidenceMap.get(id)?.watch_for).filter(Boolean).join(' ');
        const artTypes=uniq(splitIds(s.artifacts).map(id=>artifactMap.get(id)?.artifact_type).filter(Boolean));
        return `<section class="session-card"><div class="session-top"><h4>${s.session}. ${esc(adaptedSessionTitle(s))}</h4><span class="duration">${esc(s.duration_min)} min</span></div><p class="session-activity">${esc(adaptedSessionActivity(s))}</p><div class="session-grid"><div class="session-block"><label>Currículum</label><p>${curricular.slice(0,5).map(displayEntity).map(esc).join(' · ')}</p></div><div class="session-block"><label>Prácticas STEAM</label><p>${steam.slice(0,5).map(displayEntity).map(esc).join(' · ')}</p></div><div class="session-block"><label>Pedagogía / DUA</label><p>${pedagogy.slice(0,5).map(displayEntity).map(esc).join(' · ')}</p></div><div class="session-block"><label>Evidencia y materiales</label><p>${esc(ev||s.teacher_watch_for||'')} ${artTypes.length?` Materiales: ${esc(artTypes.join(', '))}.`:''}</p></div></div><div class="trace-row"><div class="trace-chips">${ids.slice(0,12).map(traceChip).join('')}${ids.length>12?`<span class="mini-chip">+${ids.length-12} nodos</span>`:''}</div><button class="trace-button" data-trace-session="${s.session}">Ver construcción en el grafo</button></div></section>`
      }).join('')}</div></article>`
    }).join('')}</div><div class="project-card" style="margin-top:14px"><div class="eyebrow">Base PBL</div><p style="margin-bottom:0">La organización por fases sigue el <strong>Project Path</strong> de PBLWorks: lanzar; construir conocimientos, comprensión y habilidades; desarrollar/criticar productos y respuestas; y presentar productos/respuestas. Los siete elementos de diseño Gold Standard se usan como criterios de coherencia del proyecto.</p></div>`;
    document.querySelectorAll('[data-trace-session]').forEach(b=>b.addEventListener('click',()=>showSessionInGraph(Number(b.dataset.traceSession))));
  }

  function showSessionInGraph(sessionNum){
    const s=journey.find(x=>Number(x.session)===sessionNum); if(!s)return; const ids=new Set(sessionTraceIds(s));
    // Include direct bridges so the trace reads as a path rather than isolated chips.
    let changed=true,loops=0; while(changed&&loops<2){changed=false;loops++;relationships.forEach(r=>{if(ids.has(r.source_entity_id)&&entityMap.has(r.target_entity_id)&&['L1','L2','L3'].includes(entityMap.get(r.target_entity_id).layer)){if(['maps_to_steam_practice','supports_curriculum_skill','supports_steam_practice','has_evidence_intent','can_apply_udl_consideration','has_support_artifact','has_developmental_adaptation','targets_concept','has_practice'].includes(r.relationship_type)&&!ids.has(r.target_entity_id)){ids.add(r.target_entity_id);changed=true}}if(ids.has(r.target_entity_id)&&entityMap.has(r.source_entity_id)&&['maps_to_steam_practice','supports_curriculum_skill','supports_steam_practice','targets_concept','has_practice'].includes(r.relationship_type)&&!ids.has(r.source_entity_id)){ids.add(r.source_entity_id);changed=true}})}
    state.focusIds=ids; state.preset='focus';state.domain='all';state.provenance='all';$('domainSelect').value='all';$('provenanceSelect').value='all';ensureFocusOption();switchView('graph');setTimeout(()=>renderGraph({fit:true}),20);
  }

  function renderSources(){
    $('sourceLegend').innerHTML=`<span class="badge official">Oficial Mineduc</span><span class="badge external">Marco externo</span><span class="badge expert">Síntesis / aplicación experta</span><span class="badge prototype">Prototipo Erandi</span><span class="badge review">Revisión pendiente</span>`;
    $('sourceTable').innerHTML=sources.map(s=>`<article class="source-card"><div><strong>${esc(s.title)}</strong><p>${esc(s.notes||'')}</p></div><span>${esc(s.publisher||'—')}</span><span><span class="badge ${provenanceClass(s.provenance_class)}">${esc(provenanceText(s.provenance_class))}</span></span><span>${s.url_or_ref?`<a href="${esc(s.url_or_ref)}" target="_blank" rel="noreferrer">Abrir ↗</a>`:'Sin URL'}</span></article>`).join('') + `<article class="source-card"><div><strong>PBLWorks — Project Path / Gold Standard PBL</strong><p>Fuentes utilizadas únicamente para estructurar la trayectoria PBL de demostración.</p></div><span>PBLWorks</span><span><span class="badge external">Marco externo</span></span><span><a href="${esc(pblProject.source_refs?.[0]?.url||'#')}" target="_blank" rel="noreferrer">Abrir ↗</a></span></article>`;
  }

  function buildLegend(){ $('legendCard').innerHTML=`<strong>Color de capa</strong><div class="legend-row"><span class="legend-swatch" style="background:var(--l1)"></span>Currículum</div><div class="legend-row"><span class="legend-swatch" style="background:var(--l2)"></span>Marco STEAM</div><div class="legend-row"><span class="legend-swatch" style="background:var(--l3)"></span>Inteligencia pedagógica</div><strong style="display:block;margin-top:9px">Borde = procedencia</strong><div class="legend-row"><span class="legend-swatch" style="border:2px solid var(--official)"></span>Oficial</div><div class="legend-row"><span class="legend-swatch" style="border:2px solid var(--external)"></span>Marco externo</div><div class="legend-row"><span class="legend-swatch" style="border:2px solid var(--expert)"></span>Síntesis experta</div><div class="legend-row"><span class="legend-swatch" style="border:2px solid var(--prototype)"></span>Prototipo Erandi</div><p style="color:var(--muted);margin:8px 0 0">Las líneas punteadas cruzan capas. Las etiquetas aparecen al seleccionar un nodo.</p>`; }

  function setupSearch(){
    const input=$('nodeSearch'),results=$('searchResults');
    input.addEventListener('input',()=>{const q=input.value.trim().toLowerCase();if(q.length<2){results.classList.add('hidden');return}const found=entities.filter(e=>`${e.name} ${e.code||''} ${e.entity_id}`.toLowerCase().includes(q)).slice(0,12);results.innerHTML=found.map(e=>`<div class="search-result" data-search-id="${esc(e.entity_id)}"><strong>${esc(e.name)}</strong><small>${esc(typeLabels[e.normalized_type]||e.local_type||'')} · ${esc(e.code||e.entity_id)}</small></div>`).join('')||'<div class="search-result">Sin resultados</div>';results.classList.remove('hidden')});
    results.addEventListener('click',ev=>{const row=ev.target.closest('[data-search-id]');if(!row)return;input.value='';results.classList.add('hidden');focusNode(row.dataset.searchId)});
    document.addEventListener('click',ev=>{if(!ev.target.closest('.search-box'))results.classList.add('hidden')});
  }

  function setupGraphEvents(){
    svg.addEventListener('click',()=>{if(state.selectedId){clearSelectionRibbon()}});
    svg.addEventListener('wheel',ev=>{ev.preventDefault();const r=svg.getBoundingClientRect();zoom(ev.deltaY<0?1.12:.89,ev.clientX-r.left,ev.clientY-r.top)},{passive:false});
    svg.addEventListener('pointerdown',ev=>{if(ev.target.closest('.node'))return;state.drag=true;state.lastX=ev.clientX;state.lastY=ev.clientY;svg.setPointerCapture(ev.pointerId)});
    svg.addEventListener('pointermove',ev=>{if(!state.drag)return;state.tx+=ev.clientX-state.lastX;state.ty+=ev.clientY-state.lastY;state.lastX=ev.clientX;state.lastY=ev.clientY;applyTransform()});
    svg.addEventListener('pointerup',()=>state.drag=false);svg.addEventListener('pointercancel',()=>state.drag=false);
  }

  function setupControls(){
    document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>switchView(t.dataset.view)));
    $('presetSelect').addEventListener('change',e=>{state.focusIds=null;state.preset=e.target.value;renderGraph({fit:true})});
    $('domainSelect').addEventListener('change',e=>{state.domain=e.target.value;renderGraph({fit:true})});
    $('provenanceSelect').addEventListener('change',e=>{state.provenance=e.target.value;renderGraph({fit:true})});
    $('zoomIn').addEventListener('click',()=>zoom(1.2));$('zoomOut').addEventListener('click',()=>zoom(.83));$('fitGraph').addEventListener('click',fitToScreen);
    $('resetGraph').addEventListener('click',()=>{state.focusIds=null;state.preset='bees';state.domain='all';state.provenance='all';state.selectedId=null;$('presetSelect').value='bees';$('domainSelect').value='all';$('provenanceSelect').value='all';renderGraph({fit:true});clearSelectionRibbon()});
    $('focusSelected').addEventListener('click',()=>state.selectedId&&focusNode(state.selectedId));$('copySelectedId').addEventListener('click',async()=>{if(!state.selectedId)return;try{await navigator.clipboard.writeText(state.selectedId);$('copySelectedId').textContent='Copiado';setTimeout(()=>$('copySelectedId').textContent='Copiar ID',900)}catch{$('copySelectedId').textContent=state.selectedId}});$('openSelectedDetails').addEventListener('click',()=>state.selectedId&&openDetails(state.selectedId));
    $('toggleLegend').addEventListener('click',()=>$('legendCard').classList.toggle('hidden'));
    $('openReviewHelp').addEventListener('click',()=>$('helpModal').classList.remove('hidden'));
    document.querySelectorAll('[data-close-modal]').forEach(x=>x.addEventListener('click',()=>$('detailsModal').classList.add('hidden')));document.querySelectorAll('[data-close-help]').forEach(x=>x.addEventListener('click',()=>$('helpModal').classList.add('hidden')));
    window.addEventListener('keydown',e=>{if(e.key==='Escape'){[$('detailsModal'),$('helpModal')].forEach(m=>m.classList.add('hidden'))}});
  }

  initGraph(); buildLegend(); setupSearch(); setupGraphEvents(); setupControls(); renderSteam(); renderPedagogy(); renderJourney(); renderSources(); renderGraph({fit:true});
})();
