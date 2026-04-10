(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))a(i);new MutationObserver(i=>{for(const s of i)if(s.type==="childList")for(const o of s.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&a(o)}).observe(document,{childList:!0,subtree:!0});function n(i){const s={};return i.integrity&&(s.integrity=i.integrity),i.referrerPolicy&&(s.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?s.credentials="include":i.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function a(i){if(i.ep)return;i.ep=!0;const s=n(i);fetch(i.href,s)}})();function oa(e,t){var n,a,i,s,o,c,m,p;return t.lastRepoLoadFailure&&da(e.loadState.source)?{tone:"degraded",title:e.loadState.source==="stale-snapshot"?"Using older snapshot":"Using cached snapshot",detail:`Kiwi kept the last usable snapshot because fresh repo-local state failed to load. It is safe for inspection, but not trusted for workflow execution: ${t.lastRepoLoadFailure}`,nextCommand:null,actionLabel:"Reload state"}:e.repoState.mode==="bridge-unavailable"||e.loadState.source==="bridge-fallback"?{tone:"failed",title:"Desktop bridge unavailable",detail:t.lastRepoLoadFailure??"Kiwi could not load repo-local state into the desktop shell.",nextCommand:null,actionLabel:"Reload state"}:e.repoState.mode==="repo-not-initialized"?{tone:"blocked",title:"Repo not initialized",detail:"Kiwi opened the repo, but the repo-local continuity files are not set up yet.",nextCommand:"kc init"}:e.repoState.mode==="initialized-invalid"||e.validation.errors>0||(a=(n=e.kiwiControl)==null?void 0:n.executionPlan)!=null&&a.blocked?{tone:"blocked",title:e.readiness.label,detail:((s=(i=e.runtimeDecision)==null?void 0:i.recovery)==null?void 0:s.reason)??e.readiness.detail,nextCommand:Yt(e)}:e.executionState.lifecycle==="blocked"||e.executionState.lifecycle==="failed"?{tone:((c=(o=e.runtimeDecision)==null?void 0:o.recovery)==null?void 0:c.kind)==="failed"||e.executionState.lifecycle==="failed"?"failed":"blocked",title:e.readiness.label,detail:((p=(m=e.runtimeDecision)==null?void 0:m.recovery)==null?void 0:p.reason)??e.readiness.detail,nextCommand:Yt(e)}:null}function ra(e,t,n){return e==="checkpoint"?{tone:"blocked",title:"Checkpoint unavailable",detail:t,nextCommand:n}:e==="handoff"?{tone:"blocked",title:"Handoff unavailable",detail:t,nextCommand:n}:{tone:"blocked",title:"Run Auto needs a real goal",detail:t,nextCommand:n}}function ca(e){return e?{tone:"blocked",title:"Why it stopped",detail:e.reason,nextCommand:e.fixCommand,followUpCommand:e.retryCommand}:null}function la(e){return{title:"Kiwi Control failed to start",intro:"The renderer hit an error before it could mount the UI.",steps:["Relaunch Kiwi Control once to confirm the failure is repeatable.","Run `kc ui` from Terminal to check whether the desktop bridge starts cleanly there.","If it still fails, capture the error details below before reporting it."],detail:e}}function Yt(e){var t,n,a,i,s,o,c,m,p,y,r,w;return((n=(t=e.runtimeDecision)==null?void 0:t.recovery)==null?void 0:n.fixCommand)??((a=e.runtimeDecision)==null?void 0:a.nextCommand)??e.executionState.nextCommand??e.readiness.nextCommand??((o=(s=(i=e.kiwiControl)==null?void 0:i.executionPlan)==null?void 0:s.lastError)==null?void 0:o.fixCommand)??((p=(m=(c=e.kiwiControl)==null?void 0:c.executionPlan)==null?void 0:m.lastError)==null?void 0:p.retryCommand)??((w=(r=(y=e.kiwiControl)==null?void 0:y.executionPlan)==null?void 0:r.nextCommands)==null?void 0:w[0])??`kiwi-control validate --target "${e.targetRoot}"`}function da(e){return e==="warm-snapshot"||e==="stale-snapshot"}function It(){return document.querySelector("#boot-overlay")}function wn(e,t){const n=It();n&&(n.classList.remove("is-hidden"),n.innerHTML=`
    <div class="kc-boot-fallback">
      <div class="kc-boot-card">
        <h1>${De(e)}</h1>
        <p>${De(t)}</p>
      </div>
    </div>
  `)}function ht(e){const t=It();if(!t)return;const n=la(e);t.classList.remove("is-hidden"),t.innerHTML=`
    <div class="kc-boot-fallback">
      <div class="kc-boot-card">
        <h1>${De(n.title)}</h1>
        <p>${De(n.intro)}</p>
        <ol>
          ${n.steps.map(a=>`<li>${De(a)}</li>`).join("")}
        </ol>
        <pre>${De(n.detail)}</pre>
      </div>
    </div>
  `}function ua(){var e;(e=It())==null||e.classList.add("is-hidden")}function De(e){return e.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;")}window.__KIWI_BOOT_API__={mounted:!1,renderMessage:wn,renderError:ht,hide:ua};wn("Loading Kiwi Control","External boot diagnostics loaded. If this message never changes, the main renderer bundle is failing before mount.");window.addEventListener("error",e=>{var t;(t=window.__KIWI_BOOT_API__)!=null&&t.mounted||ht(e.message||"Unknown startup error")});window.addEventListener("unhandledrejection",e=>{var n;if((n=window.__KIWI_BOOT_API__)!=null&&n.mounted)return;const t=e.reason;ht(typeof t=="string"?t:(t==null?void 0:t.message)??"Unhandled promise rejection")});window.setTimeout(()=>{var e;(e=window.__KIWI_BOOT_API__)!=null&&e.mounted||ht("Renderer timeout: the main UI bundle did not report a successful mount.")},3e3);function pa(e,t=!1){return window.__TAURI_INTERNALS__.transformCallback(e,t)}async function G(e,t={},n){return window.__TAURI_INTERNALS__.invoke(e,t,n)}var Xt;(function(e){e.WINDOW_RESIZED="tauri://resize",e.WINDOW_MOVED="tauri://move",e.WINDOW_CLOSE_REQUESTED="tauri://close-requested",e.WINDOW_DESTROYED="tauri://destroyed",e.WINDOW_FOCUS="tauri://focus",e.WINDOW_BLUR="tauri://blur",e.WINDOW_SCALE_FACTOR_CHANGED="tauri://scale-change",e.WINDOW_THEME_CHANGED="tauri://theme-changed",e.WINDOW_CREATED="tauri://window-created",e.WEBVIEW_CREATED="tauri://webview-created",e.DRAG_ENTER="tauri://drag-enter",e.DRAG_OVER="tauri://drag-over",e.DRAG_DROP="tauri://drag-drop",e.DRAG_LEAVE="tauri://drag-leave"})(Xt||(Xt={}));async function ma(e,t){window.__TAURI_EVENT_PLUGIN_INTERNALS__.unregisterListener(e,t),await G("plugin:event|unlisten",{event:e,eventId:t})}async function Qt(e,t,n){var a;const i=(a=void 0)!==null&&a!==void 0?a:{kind:"Any"};return G("plugin:event|listen",{event:e,target:i,handler:pa(t)}).then(s=>async()=>ma(e,s))}function ha(e){const{state:t,repoLabel:n,phase:a,topMetadata:i,primaryBanner:s,actionCluster:o,runtimeBadge:c,themeLabel:m,activeTheme:p,activeMode:y,isLogDrawerOpen:r,isInspectorOpen:w,currentTargetRoot:v,commandState:$,composerConstraint:u,helpers:d}=e,{escapeHtml:b,escapeAttribute:T,iconSvg:l,formatCliCommand:C,renderHeaderBadge:D,renderHeaderMeta:q}=d,V=!v||$.loading;return`
    <div class="kc-topbar-primary">
      <div class="kc-topbar-left">
        <button class="kc-repo-pill" type="button">
          <span class="kc-repo-name">${b(n)}</span>
          <span class="kc-repo-path">${b(t.targetRoot||"No repo loaded yet")}</span>
        </button>
        ${D(t.repoState.title,t.repoState.mode)}
        ${a!=="none recorded"?D(a,"neutral"):""}
      </div>
      <div class="kc-topbar-center">
        ${i.centerItems.map(N=>q(N.label,N.value)).join("")}
      </div>
      <div class="kc-topbar-right">
        <div class="kc-inline-badges">
          <button class="kc-tab-button ${y==="execution"?"is-active":""}" type="button" data-ui-mode="execution">Execution</button>
          <button class="kc-tab-button ${y==="inspection"?"is-active":""}" type="button" data-ui-mode="inspection">Inspection</button>
        </div>
        <div class="kc-status-chip">
          <strong>${b(y)}</strong>
          <span>${b(i.statusDetail)}</span>
        </div>
        ${c?`<span class="kc-inline-badge is-muted">${b(c)}</span>`:""}
        <button class="kc-theme-toggle" type="button" data-theme-toggle>
          ${l(p==="dark"?"sun":"moon")}
          <span>${b(m)}</span>
        </button>
        <button class="kc-icon-button" type="button" data-toggle-logs>
          ${l(r?"logs-open":"logs-closed")}
        </button>
        <button class="kc-icon-button" type="button" data-toggle-inspector>
          ${l(w?"panel-open":"panel-closed")}
        </button>
      </div>
    </div>
    <div class="kc-topbar-actions">
      <div class="kc-topbar-action-group">
        ${o.primary.directCommand?`<button class="kc-action-button kc-action-button-primary" type="button" data-direct-command="${T(o.primary.directCommand)}" ${V?"disabled":""}>${b(o.primary.label)}</button>`:o.primary.composerMode?`<button class="kc-action-button kc-action-button-primary" type="button" data-ui-command="${T(o.primary.composerMode)}" ${V?"disabled":""}>${b(o.primary.label)}</button>`:`<button class="kc-action-button kc-action-button-primary" type="button" data-ui-command="${T(o.primary.command??"guide")}" ${V?"disabled":""}>${b(o.primary.label)}</button>`}
        <details class="kc-action-menu">
          <summary class="kc-secondary-button kc-action-button">More</summary>
          <div class="kc-action-menu-panel">
            ${o.secondary.map(N=>N.directCommand?`<button class="kc-secondary-button kc-action-button" type="button" data-direct-command="${T(N.directCommand)}" ${V?"disabled":""}>${b(N.label)}</button>`:N.composerMode?`<button class="kc-secondary-button kc-action-button" type="button" data-ui-command="${T(N.composerMode)}" ${V?"disabled":""}>${b(N.label)}</button>`:`<button class="kc-secondary-button kc-action-button" type="button" data-ui-command="${T(N.command??"guide")}" ${V?"disabled":""}>${b(N.label)}</button>`).join("")}
          </div>
        </details>
      </div>
      ${$.composer?`
          <div class="kc-action-composer">
            <span class="kc-section-micro">${b($.composer)}</span>
            ${$.composer==="handoff"?`<select class="kc-action-input" data-command-draft>
                  ${[...new Set([$.draftValue,...t.specialists.handoffTargets].filter(Boolean))].map(N=>`
                    <option value="${T(N)}" ${N===$.draftValue?"selected":""}>${b(N)}</option>
                  `).join("")}
                </select>`:`<input class="kc-action-input" data-command-draft value="${T($.draftValue)}" placeholder="${T($.composer==="checkpoint"?"checkpoint label":"run description")}" />`}
            <button class="kc-secondary-button kc-action-button is-primary" type="button" data-composer-submit="${$.composer}" ${$.loading||u!=null&&u.blocked?"disabled":""}>Run</button>
            <button class="kc-secondary-button kc-action-button" type="button" data-composer-cancel ${$.loading?"disabled":""}>Cancel</button>
          </div>
          ${u?`<div class="kc-action-hint ${u.blocked?"is-blocked":""}">
                <strong>${b(u.reason)}</strong>
                ${u.nextCommand?`<code class="kc-command-chip">${b(C(u.nextCommand,v))}</code>`:""}
              </div>`:""}
        `:""}
    </div>
    ${s.visible?`
        <div class="kc-load-strip tone-${s.tone}">
          <div class="kc-load-row">
            <span class="kc-load-badge">
              <span class="kc-load-dot"></span>
              ${b(s.label)}
            </span>
            <strong>${b(s.detail)}</strong>
          </div>
          ${s.nextCommand?`<div class="kc-action-hint is-blocked"><code class="kc-command-chip">${b(C(s.nextCommand,v))}</code></div>`:""}
          <div class="kc-load-progress">
            <span class="kc-load-progress-fill" style="width:${s.progress}%"></span>
          </div>
        </div>
      `:""}
  `}function fa(e){const{state:t,graph:n,focusedNode:a,graphDepth:i,graphPan:s,graphZoom:o,graphMechanics:c,treeMechanics:m,helpers:p}=e,{escapeHtml:y,escapeAttribute:r,renderHeaderBadge:w,renderPanelHeader:v,renderNoteRow:$,renderEmptyState:u}=p;return`
    <div class="kc-view-shell">
      <section class="kc-view-header">
        <div>
          <p class="kc-view-kicker">Repo Graph</p>
          <h1>Context Graph</h1>
          <p>Repo topology from Kiwi’s current context tree. Click a node to inspect it, then use Focus, Include, Exclude, or Ignore.</p>
        </div>
        ${w(n.nodes.length>0?`${n.nodes.length} nodes`:"empty",n.nodes.length>0?"success":"warn")}
      </section>

      <section class="kc-panel">
        <div class="kc-panel-head-row">
          ${v("Graph Overview","Root-centered map of directories and files Kiwi currently knows about.")}
          <div class="kc-inline-badges">
            <button class="kc-secondary-button" type="button" data-graph-action="depth-down">Depth -</button>
            <span class="kc-inline-badge">depth ${i}</span>
            <button class="kc-secondary-button" type="button" data-graph-action="depth-up">Depth +</button>
            <button class="kc-secondary-button" type="button" data-graph-action="reset-view">Reset view</button>
          </div>
        </div>
        ${n.nodes.length>0?`
            <div class="kc-graph-shell">
              <svg class="kc-graph-canvas" data-graph-surface data-graph-canvas-root viewBox="0 0 1200 720" role="img" aria-label="Repo graph">
                <g class="kc-graph-viewport" data-graph-viewport transform="translate(${s.x} ${s.y}) scale(${o})">
                ${n.edges.map(d=>`
                  <line
                    x1="${d.from.x}"
                    y1="${d.from.y}"
                    x2="${d.to.x}"
                    y2="${d.to.y}"
                    data-graph-edge
                    data-from-path="${r(d.fromPath)}"
                    data-to-path="${r(d.toPath)}"
                    class="kc-graph-edge ${d.highlighted?"is-highlighted":""}"
                  />
                `).join("")}
                ${n.nodes.map(d=>`
                  <g
                    transform="translate(${d.x}, ${d.y})"
                    class="kc-graph-node-wrap ${d.highlighted?"is-highlighted":""}"
                    data-graph-node-wrap
                    data-path="${r(d.path)}"
                  >
                    <circle
                      r="${d.radius}"
                      data-graph-node
                      data-path="${r(d.path)}"
                      data-kind="${d.kind}"
                      class="kc-graph-node ${d.tone} importance-${d.importance}"
                    />
                    <text class="kc-graph-label" text-anchor="middle" dy=".35em">${y(d.label)}</text>
                  </g>
                `).join("")}
                </g>
              </svg>
            </div>
          `:u("No graph data is available yet. Run kiwi-control prepare to build a richer context tree.")}
      </section>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${v("Cluster Summary","Top visible nodes from the current context selection tree.")}
          ${n.summary.length>0?`<div class="kc-stack-list">${n.summary.map(d=>$(d.label,d.kind,d.meta)).join("")}</div>`:u("No cluster summary is available yet.")}
        </section>
        <section class="kc-panel">
          ${v("Node Actions",a?`${a.label} · ${a.kind}`:"Click a node in the map to act on it.")}
          ${a?`
              <div class="kc-stack-list">
                ${$("Status",a.status,`importance: ${a.importance}`)}
                ${$("Path",a.kind,a.path)}
                ${$("Project",t.projectType,t.repoState.detail)}
              </div>
              <div class="kc-divider"></div>
              <div class="kc-inline-badges">
                <button class="kc-secondary-button" type="button" data-graph-action="focus" data-path="${r(a.path)}">Focus</button>
                <button class="kc-secondary-button" type="button" data-graph-action="include" data-path="${r(a.path)}">Include</button>
                <button class="kc-secondary-button" type="button" data-graph-action="exclude" data-path="${r(a.path)}">Exclude</button>
                <button class="kc-secondary-button" type="button" data-graph-action="ignore" data-path="${r(a.path)}">Ignore</button>
                ${a.kind==="file"?`<button class="kc-secondary-button" type="button" data-graph-action="open" data-path="${r(a.path)}">Open</button>`:""}
              </div>
            `:u("No graph node is selected yet. Click a node in the map to focus it here.")}
        </section>
      </div>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${v("How This Map Is Built","This graph is projected from Kiwi’s current context tree and index signals, not from a full semantic dependency graph.")}
          ${c.length>0?`<div class="kc-stack-list">${c.map(d=>$(d.title,d.metric,d.note)).join("")}</div>`:u("No graph mechanics are available yet.")}
        </section>
        <section class="kc-panel">
          ${v("How Tree Status Works","Selected, candidate, and excluded statuses come from the current tree plus any local UI overrides.")}
          ${m.length>0?`<div class="kc-stack-list">${m.map(d=>$(d.title,d.metric,d.note)).join("")}</div>`:u("No tree mechanics are available yet.")}
        </section>
      </div>
    </div>
  `}function ga(e){const{tree:t,focusedItem:n,contextOverrides:a,helpers:i}=e,{escapeHtml:s,escapeAttribute:o}=i;return`
    <div class="kc-tree-shell">
      <div class="kc-tree-legend">
        <span><strong>✓</strong> selected</span>
        <span><strong>•</strong> candidate</span>
        <span><strong>×</strong> excluded</span>
      </div>
      <div class="kc-tree-root">
        ${t.nodes.map(c=>xn(c,n,a,i)).join("")}
      </div>
    </div>
  `}function xn(e,t,n,a){const{escapeHtml:i,escapeAttribute:s}=a,o=n.get(e.path),c=o?`override: ${o}`:e.status,m=(t==null?void 0:t.kind)==="path"&&t.path===e.path?"is-focused":"";return e.kind==="file"?`
      <div class="kc-tree-node tree-${i(e.status)} ${m}">
        <span class="kc-tree-row">
          <span class="kc-tree-status">${Zt(e.status)}</span>
          <span class="kc-tree-name">${i(e.name)}</span>
          <span class="kc-tree-actions">
            <button class="kc-tree-action" type="button" data-tree-action="focus" data-path="${s(e.path)}">Focus</button>
            <button class="kc-tree-action" type="button" data-tree-action="include" data-path="${s(e.path)}">Include</button>
            <button class="kc-tree-action" type="button" data-tree-action="exclude" data-path="${s(e.path)}">Exclude</button>
            <button class="kc-tree-action" type="button" data-tree-action="ignore" data-path="${s(e.path)}">Ignore</button>
            <button class="kc-tree-action" type="button" data-tree-action="open" data-path="${s(e.path)}">Open</button>
          </span>
        </span>
        <span class="kc-tree-meta">${i(c)}</span>
      </div>
    `:`
    <details class="kc-tree-node tree-dir tree-${i(e.status)} ${m}" ${e.expanded?"open":""}>
      <summary class="kc-tree-row">
        <span class="kc-tree-caret"></span>
        <span class="kc-tree-status">${Zt(e.status)}</span>
        <span class="kc-tree-name">${i(e.name)}/</span>
        <span class="kc-tree-actions">
          <button class="kc-tree-action" type="button" data-tree-action="focus" data-path="${s(e.path)}">Focus</button>
          <button class="kc-tree-action" type="button" data-tree-action="include" data-path="${s(e.path)}">Include</button>
          <button class="kc-tree-action" type="button" data-tree-action="exclude" data-path="${s(e.path)}">Exclude</button>
          <button class="kc-tree-action" type="button" data-tree-action="ignore" data-path="${s(e.path)}">Ignore</button>
          <button class="kc-tree-action" type="button" data-tree-action="open" data-path="${s(e.path)}">Open</button>
        </span>
      </summary>
      <div class="kc-tree-meta">${i(c)}</div>
      <div class="kc-tree-children">
        ${e.children.map(p=>xn(p,t,n,a)).join("")}
      </div>
    </details>
  `}function Zt(e){switch(e){case"selected":return"✓";case"excluded":return"×";default:return"•"}}function va(e){var l,C;const{state:t,steps:n,editingPlanStepId:a,editingPlanDraft:i,focusedItem:s,commandState:o,failureGuidance:c,helpers:m}=e,{escapeHtml:p,escapeAttribute:y,formatCliCommand:r,renderPanelHeader:w,renderInlineBadge:v,renderNoteRow:$,renderEmptyState:u,renderHeaderBadge:d}=m,b=(l=t.kiwiControl)==null?void 0:l.executionPlan,T=t.derivedFreshness.find(D=>D.outputName==="execution-plan");return b?`
    <section class="kc-panel">
      ${w("Execution Plan",`${b.summary||"No execution plan is recorded yet."} Compatibility/debug snapshot${(T==null?void 0:T.sourceRevision)!=null?` · revision ${T.sourceRevision}`:""}${T!=null&&T.generatedAt?` · generated ${T.generatedAt}`:""}.`)}
      <div class="kc-inline-badges">
        ${v(`state: ${b.state}`)}
        ${v(`current: ${((C=n[b.currentStepIndex])==null?void 0:C.id)??"none"}`)}
        ${v(`risk: ${b.risk}`)}
        ${b.confidence?v(`confidence: ${b.confidence}`):""}
      </div>
      ${c?`<div class="kc-divider"></div><div class="kc-stack-list">
            ${$("Why it stopped",c.title,c.detail)}
            ${$("Do this now",c.nextCommand?r(c.nextCommand,t.targetRoot):"No fix command recorded","Run this before continuing.")}
            ${$("Then retry",c.followUpCommand?r(c.followUpCommand,t.targetRoot):"No retry command recorded","Use this after the blocking issue is cleared.")}
          </div>`:""}
      ${n.length>0?`<div class="kc-plan-list">${n.map((D,q)=>ka(D,q,a,i,s,o.loading,{escapeHtml:p,escapeAttribute:y,renderHeaderBadge:d})).join("")}</div>`:u("No execution plan is available yet.")}
    </section>
  `:`
      <section class="kc-panel">
        ${w("Execution Plan","No execution plan is recorded yet.")}
        ${u("No execution plan is available yet.")}
      </section>
    `}function ka(e,t,n,a,i,s,o){const{escapeHtml:c,escapeAttribute:m,renderHeaderBadge:p}=o,y=n===e.id,r=(i==null?void 0:i.kind)==="step"&&i.id===e.id;return`
    <article class="kc-plan-step ${e.skipped?"is-skipped":""} ${r?"is-focused":""}" data-step-row="${m(e.id)}">
      <div class="kc-plan-step-head">
        <div>
          <span class="kc-section-micro">step ${t+1}</span>
          ${y?`<input class="kc-action-input kc-plan-edit-input" data-plan-edit-input value="${m(a)}" />`:`<strong>${c(e.displayTitle)}</strong>`}
          <p>${c(e.displayNote??e.command)}</p>
        </div>
        <div class="kc-inline-badges">
          ${p(e.status,e.status==="failed"?"warn":e.status==="success"?"success":"neutral")}
          ${e.skipped?'<span class="kc-inline-badge">skipped</span>':""}
        </div>
      </div>
      <div class="kc-plan-step-actions">
        <button class="kc-secondary-button" type="button" data-plan-action="focus" data-step-id="${m(e.id)}">Focus</button>
        <button class="kc-secondary-button" type="button" data-plan-action="run" data-step-id="${m(e.id)}" ${s?"disabled":""}>Run</button>
        <button class="kc-secondary-button" type="button" data-plan-action="retry" data-step-id="${m(e.id)}" ${s?"disabled":""}>Retry</button>
        <button class="kc-secondary-button" type="button" data-plan-action="skip" data-step-id="${m(e.id)}">${e.skipped?"Unskip":"Skip"}</button>
        ${y?`
            <button class="kc-secondary-button" type="button" data-plan-action="edit-save" data-step-id="${m(e.id)}">Save</button>
            <button class="kc-secondary-button" type="button" data-plan-action="edit-cancel" data-step-id="${m(e.id)}">Cancel</button>
          `:`<button class="kc-secondary-button" type="button" data-plan-action="edit" data-step-id="${m(e.id)}">Edit</button>`}
        <button class="kc-secondary-button" type="button" data-plan-action="move-up" data-step-id="${m(e.id)}">↑</button>
        <button class="kc-secondary-button" type="button" data-plan-action="move-down" data-step-id="${m(e.id)}">↓</button>
      </div>
      <div class="kc-plan-step-meta">
        <code class="kc-command-chip">${c(e.command)}</code>
        <span>${c(e.validation)}</span>
        ${e.retryCommand?`<span>${c(e.retryCommand)}</span>`:""}
      </div>
    </article>
  `}function ba(e){var q,V,N;const{state:t,primaryAction:n,activeSpecialist:a,topCapability:i,signalItems:s,focusedItem:o,focusedLabel:c,focusedReason:m,marker:p,activeMode:y,commandState:r,helpers:w}=e,{escapeHtml:v,renderInlineBadge:$,renderExplainabilityBadge:u,renderGateRow:d,renderBulletRow:b,renderNoteRow:T,deriveSignalImpact:l}=w,C=t.kiwiControl,D=t.derivedFreshness.find(Y=>Y.outputName==="runtime-lifecycle");return C?`
    <div class="kc-inspector-shell">
      <div class="kc-inspector-header">
        <div>
          <span>Inspector</span>
          <h2>${v(c)}</h2>
        </div>
        <button class="kc-icon-button" type="button" data-toggle-inspector>
          ×
        </button>
      </div>

      <section class="kc-inspector-section">
        <p class="kc-section-micro">Controls</p>
        <div class="kc-inline-badges">
          <button class="kc-secondary-button" type="button" data-inspector-action="approve" ${o?"":"disabled"}>Approve</button>
          <button class="kc-secondary-button" type="button" data-inspector-action="reject" ${o?"":"disabled"}>Reject</button>
          <button class="kc-secondary-button" type="button" data-inspector-action="add-to-context" ${(o==null?void 0:o.kind)!=="path"?"disabled":""}>Add to Context</button>
          <button class="kc-secondary-button" type="button" data-inspector-action="validate" ${r.loading?"disabled":""}>Trigger Validation</button>
          <button class="kc-secondary-button" type="button" data-inspector-action="handoff" ${r.loading?"disabled":""}>Quick Handoff</button>
        </div>
        <div class="kc-divider"></div>
        ${T("Selection",(o==null?void 0:o.kind)??"global",m)}
        ${T("Decision",p,o?"Local inspector review state for the current focus.":"Select a node or plan step to review it here.")}
      </section>

      <section class="kc-inspector-section">
        <p class="kc-section-micro">Reasoning</p>
        <p>${v(m)}</p>
        <div class="kc-inline-badges">
          ${$(((q=C.contextView.confidence)==null?void 0:q.toUpperCase())??"UNKNOWN")}
          ${$(C.contextView.confidenceDetail??"No confidence detail")}
          ${u("heuristic",C.contextTrace.honesty.heuristic)}
          ${u("low confidence",C.contextTrace.honesty.lowConfidence)}
          ${u("partial scan",C.contextTrace.honesty.partialScan||C.tokenBreakdown.partialScan||C.indexing.partialScan)}
        </div>
      </section>

      <section class="kc-inspector-section">
        <p class="kc-section-micro">Decision inputs</p>
        ${s.length>0?`<div class="kc-stack-list">${s.map(Y=>T(Y,"impact",l(Y))).join("")}</div>`:"<p>No decision inputs are currently surfaced.</p>"}
      </section>

      <section class="kc-inspector-section">
        <p class="kc-section-micro">Lifecycle</p>
        <div class="kc-gate-list">
          ${d("Stage",C.runtimeLifecycle.currentStage,"default")}
          ${d("Validation",C.runtimeLifecycle.validationStatus??"unknown",C.runtimeLifecycle.validationStatus==="error"?"warn":"default")}
        </div>
        <p>${v(C.runtimeLifecycle.nextRecommendedAction??"No runtime lifecycle recommendation is recorded yet.")}</p>
        <p>${v(`Compatibility/debug snapshot${(D==null?void 0:D.sourceRevision)!=null?` · revision ${D.sourceRevision}`:""}${D!=null&&D.generatedAt?` · generated ${D.generatedAt}`:""}.`)}</p>
      </section>

      <section class="kc-inspector-section">
        <p class="kc-section-micro">Token estimate</p>
        <div class="kc-gate-list">
          ${d("Measured",C.measuredUsage.available?C.measuredUsage.totalTokens.toLocaleString("en-US"):"none",C.measuredUsage.available?"success":"default")}
          ${d("Selected",`~${C.tokenAnalytics.selectedTokens.toLocaleString("en-US")}`,"default")}
          ${d("Full repo",`~${C.tokenAnalytics.fullRepoTokens.toLocaleString("en-US")}`,"default")}
          ${d("Saved",`~${C.tokenAnalytics.savingsPercent}%`,"success")}
        </div>
        <p>${v(C.measuredUsage.available?C.measuredUsage.note:C.tokenAnalytics.estimateNote??"No repo-local token estimate is available yet.")}</p>
      </section>

      ${y==="inspection"?`
          <section class="kc-inspector-section">
            <p class="kc-section-micro">MCP usage</p>
            <div class="kc-gate-list">
              ${d("Pack",((V=t.mcpPacks.selectedPack)==null?void 0:V.name)??((N=t.mcpPacks.selectedPack)==null?void 0:N.id)??t.mcpPacks.suggestedPack.name??t.mcpPacks.suggestedPack.id,"default")}
              ${d("Compatible",String(t.mcpPacks.compatibleCapabilities.length),t.mcpPacks.compatibleCapabilities.length>0?"success":"warn")}
              ${d("Top capability",(i==null?void 0:i.id)??"none",i?"success":"warn")}
            </div>
            <p>${v(t.mcpPacks.note)}</p>
          </section>

          <section class="kc-inspector-section">
            <p class="kc-section-micro">Specialist usage</p>
            <div class="kc-gate-list">
              ${d("Active",(a==null?void 0:a.name)??t.specialists.activeSpecialist,"default")}
              ${d("Risk",(a==null?void 0:a.riskPosture)??"unknown",(a==null?void 0:a.riskPosture)==="conservative"?"success":"default")}
              ${d("Tool fit",((a==null?void 0:a.preferredTools)??[]).join(", ")||"none","default")}
            </div>
            <p>${v((a==null?void 0:a.purpose)??t.specialists.safeParallelHint)}</p>
          </section>

          <section class="kc-inspector-section">
            <p class="kc-section-micro">Skills & trace</p>
            ${C.skills.activeSkills.length>0?`<div class="kc-stack-list">${C.skills.activeSkills.slice(0,3).map(Y=>b(`${Y.name} — ${Y.executionTemplate[0]??Y.description}`)).join("")}</div>`:"<p>No active skills are currently matched.</p>"}
          </section>
        `:""}

      <section class="kc-inspector-section">
        <p class="kc-section-micro">Command</p>
        ${r.lastResult?`<code class="kc-command-block">${v(r.lastResult.commandLabel)}</code>`:n!=null&&n.command?`<code class="kc-command-block">${v(n.command)}</code>`:"<p>No command recorded for the current state.</p>"}
      </section>
    </div>
  `:`
      <div class="kc-inspector-shell">
        <div class="kc-inspector-header">
          <div>
            <span>Inspector</span>
            <h2>${v(c)}</h2>
          </div>
          <button class="kc-icon-button" type="button" data-toggle-inspector>×</button>
        </div>
        <section class="kc-inspector-section">
          <p class="kc-section-micro">Reasoning</p>
          <p>${v(m)}</p>
        </section>
      </div>
    `}function ya(e,t){var r,w,v,$,u,d,b,T;const n=e.kiwiControl,a=((r=n==null?void 0:n.nextActions.actions[0])==null?void 0:r.action)??e.repoState.title,i=((v=(w=e.runtimeDecision)==null?void 0:w.recovery)==null?void 0:v.reason)??(($=n==null?void 0:n.executionPlan.lastError)==null?void 0:$.reason)??(e.validation.errors>0?`${e.validation.errors} validation error${e.validation.errors===1?"":"s"}`:"none"),s=((n==null?void 0:n.execution.recentExecutions.filter(l=>!l.success).length)??0)+((n==null?void 0:n.workflow.steps.filter(l=>l.status==="failed").length)??0),o=e.validation.warnings+e.machineAdvisory.systemHealth.warningCount,c=e.validation.errors>0||e.machineAdvisory.systemHealth.criticalCount>0?"blocked":o>0?"attention":"healthy",m=t.isLoadingRepoState?"loading":t.isRefreshingFreshRepoState||t.hasWarmSnapshot?"guarded":c==="blocked"?"blocked":(n==null?void 0:n.contextView.confidence)==="low"||n!=null&&n.indexing.partialScan?"guarded":"ready",p=[(u=n==null?void 0:n.execution.recentExecutions[0])==null?void 0:u.timestamp,(d=n==null?void 0:n.runtimeLifecycle.recentEvents[0])==null?void 0:d.timestamp,(b=n==null?void 0:n.feedback.recentEntries[0])==null?void 0:b.timestamp].filter(l=>!!l),y=p.length>0?t.formatTimestamp(((T=p.map(l=>new Date(l)).sort((l,C)=>C.getTime()-l.getTime())[0])==null?void 0:T.toISOString())??""):"unknown";return{nextAction:a,blockingIssue:i,systemHealth:c,executionSafety:m,lastChangedAt:y,recentFailures:s,newWarnings:o}}function $a(e){if(!e.loadStatus.visible)return{visible:!1,phaseLabel:"",label:"",detail:"",tone:"ready",progress:100,nextCommand:null};let t=e.loadStatus.detail;return e.loadStatus.tone==="blocked"?t=e.activeView==="overview"?"Use the primary recovery action below.":"Use the repo-scoped recovery command for this repo.":e.loadStatus.tone==="degraded"&&(t="Using cached or degraded repo state. Use the repair command if this does not recover on its own."),{visible:!0,phaseLabel:e.loadStatus.phase.replaceAll("_"," "),label:e.loadStatus.label,detail:t,tone:e.loadStatus.tone,progress:e.loadStatus.progress,nextCommand:e.loadStatus.nextCommand}}function wa(e){const t=e.state.primaryAction;return{title:(t==null?void 0:t.action)??e.state.repoTitle,detail:(t==null?void 0:t.reason)??e.state.nextActionSummary??e.state.repoDetail,badgeLabel:(t==null?void 0:t.priority)??"neutral",badgeTone:(t==null?void 0:t.priority)??"neutral",command:e.primaryActionCommand,supportingText:e.currentFocus}}function xa(e){return{centerItems:[{label:"Next",value:e.state.decision.nextAction},{label:"Repo",value:e.state.projectType},{label:"Status",value:`${e.state.decision.systemHealth} · ${e.state.decision.executionSafety}`},{label:"Changed",value:e.state.decision.lastChangedAt}],statusDetail:`${e.state.executionMode} · ${e.state.validationState}`}}function Sa(e,t){return t==="inspection"}function Ca(e){const t=e.selectedPackSource==="runtime-explicit"?"Pinned for this repo":"Default for this repo",n=e.selectedPackSource==="runtime-explicit"?"Runtime explicit":"Heuristic default",a=e.available.find(s=>s.id===e.selectedPack.id)??null,i=(s,o={})=>({id:s.id,name:s.name??s.id,description:s.description,stateLabel:s.executable?"Executable":"Blocked",stateTone:s.executable?"neutral":"warn",sourceLabel:null,blockedReason:s.unavailablePackReason,allowedCapabilityIds:s.allowedCapabilityIds,preferredCapabilityIds:s.preferredCapabilityIds,guidance:(s.guidance??[]).slice(0,2),...o});return{selectedPackCard:{id:e.selectedPack.id,name:e.selectedPack.name??e.selectedPack.id,description:e.selectedPack.description,stateLabel:t,stateTone:e.selectedPackSource==="runtime-explicit"?"success":"neutral",sourceLabel:n,blockedReason:(a==null?void 0:a.unavailablePackReason)??null,allowedCapabilityIds:(a==null?void 0:a.allowedCapabilityIds)??[],preferredCapabilityIds:(a==null?void 0:a.preferredCapabilityIds)??[],guidance:(e.selectedPack.guidance??[]).slice(0,2)},executablePackCards:e.available.filter(s=>s.executable&&s.id!==e.selectedPack.id).map(s=>i(s)),blockedPackCards:e.available.filter(s=>!s.executable).map(s=>i(s,{stateTone:"warn"})),showClearAction:e.explicitSelection!==null,selectedPackLabel:t,selectedPackSourceLabel:n}}function Ra(e){const t=(e==null?void 0:e.trim())??"";return t?/\bguide\b/.test(t)?{label:"Guide",command:"guide",directCommand:null,composerMode:null}:/\bnext\b/.test(t)?{label:"Next",command:"next",directCommand:null,composerMode:null}:/\breview\b/.test(t)?{label:"Review",command:"review",directCommand:null,composerMode:null}:/\bvalidate\b/.test(t)?{label:"Validate",command:"validate",directCommand:null,composerMode:null}:/\bretry\b/.test(t)?{label:"Retry",command:"retry",directCommand:null,composerMode:null}:/\brun\b.*\b--auto\b/.test(t)?{label:"Run Auto",command:null,directCommand:null,composerMode:"run-auto"}:/\bcheckpoint\b/.test(t)?{label:"Checkpoint",command:null,directCommand:null,composerMode:"checkpoint"}:/\bhandoff\b/.test(t)?{label:"Handoff",command:null,directCommand:null,composerMode:"handoff"}:{label:"Run next step",command:null,directCommand:t,composerMode:null}:null}function Pa(e){const n=Ra(e.nextCommand)??{label:e.nextActionLabel||"Guide",command:"guide",directCommand:null,composerMode:null},a=[{label:"Guide",command:"guide",directCommand:null,composerMode:null},{label:"Next",command:"next",directCommand:null,composerMode:null},{label:"Review",command:"review",directCommand:null,composerMode:null},{label:"Validate",command:"validate",directCommand:null,composerMode:null},...e.retryEnabled?[{label:"Retry",command:"retry",directCommand:null,composerMode:null}]:[],...e.hasTask?[{label:"Run Auto",command:null,directCommand:null,composerMode:"run-auto"}]:[],{label:"Checkpoint",command:null,directCommand:null,composerMode:"checkpoint"},...e.handoffAvailable?[{label:"Handoff",command:null,directCommand:null,composerMode:"handoff"}]:[]];return{primary:n,secondary:a.filter(i=>i.label!==n.label||i.command!==n.command||i.composerMode!==n.composerMode||i.directCommand!==n.directCommand)}}function Ta(e){const t=[{label:"Planning",score:e.optimizationScore.planning.score,missingSignals:e.optimizationScore.planning.missingSignals},{label:"Execution",score:e.optimizationScore.execution.score,missingSignals:e.optimizationScore.execution.missingSignals},{label:"Assistant",score:e.optimizationScore.assistant.score,missingSignals:e.optimizationScore.assistant.missingSignals}],n=[...t].sort((y,r)=>r.score-y.score)[0],a=[...t].sort((y,r)=>y.score-r.score)[0],i=e.guidance.find(y=>y.priority==="critical")??e.guidance.find(y=>y.priority==="recommended")??null,s=(i==null?void 0:i.fixCommand)??(i==null?void 0:i.hintCommand)??"Run kiwi-control usage",o=(i==null?void 0:i.message)??a.missingSignals[0]??"No major machine gaps detected.",c=e.setupSummary.installedTools.readyCount<e.setupSummary.installedTools.totalCount||e.setupSummary.healthyConfigs.readyCount<e.setupSummary.healthyConfigs.totalCount||!e.setupSummary.readyRuntimes.planning||!e.setupSummary.readyRuntimes.execution||!e.setupSummary.readyRuntimes.assistant,m=a.score<70,p=e.stale?"stale":e.systemHealth.criticalCount>0||c||m||e.systemHealth.warningCount>0?"partial":"ready";return{overallStatus:p,overallTone:p==="ready"?"success":"warn",title:p==="ready"?"Machine setup is ready":p==="stale"?"Machine advisory is stale":"Machine setup needs attention",detail:p==="ready"?"Fresh machine signals show the primary runtimes and configs in good shape.":p==="stale"?"Refresh the machine advisory before trusting setup guidance or suggested fixes.":"At least one install, config, or runtime gap is still active for this machine.",bestHeuristicLabel:`${n.label} heuristic`,bestHeuristicValue:`${n.score}%`,strongestGapLabel:i?"Strongest gap":`${a.label} gap`,strongestGapDetail:o,nextFixLabel:"Next recommended fix",nextFixCommand:s}}function Aa(e){const t=e.state.kiwiControl,n=t.nextActions.actions[0]??null,a=e.state.specialists.activeProfile,i=e.state.mcpPacks.compatibleCapabilities[0]??null,s=t.decisionLogic.inputSignals.slice(0,e.activeMode==="execution"?3:5),o=e.resolveFocusedStep(e.focusedItem),c=e.resolveFocusedNode(e.focusedItem),m=(o==null?void 0:o.displayTitle)??(c==null?void 0:c.name)??(n==null?void 0:n.action)??"No blocking action",p=(o==null?void 0:o.displayNote)??(c==null?void 0:c.path)??(n==null?void 0:n.reason)??t.nextActions.summary??e.state.repoState.detail;return{state:e.state,primaryAction:n,activeSpecialist:a,topCapability:i,signalItems:s,focusedStep:o,focusedNode:c,focusedItem:e.focusedItem,focusedLabel:m,focusedReason:p,marker:e.marker,activeMode:e.activeMode,commandState:e.commandState}}function Ma(e){const{state:t,activeMode:n,helpers:a}=e,{escapeHtml:i,escapeAttribute:s,iconSvg:o,iconLabel:c,renderHeaderBadge:m,renderPanelHeader:p,renderInlineBadge:y,renderNoteRow:r,renderEmptyState:w,renderStatCard:v,renderInfoRow:$,formatInteger:u,formatPercent:d,formatCurrency:b,formatTimestamp:T}=a,l=t.machineAdvisory,C=Ta(l),D={critical:l.guidance.filter(f=>f.group==="critical-issues"),recommended:l.guidance.filter(f=>f.group==="improvements"),optional:l.guidance.filter(f=>f.group==="optional-optimizations")},q=(f,X)=>`
    <div class="kc-table-shell">
      <table class="kc-data-table">
        <thead>
          <tr>${f.map(Se=>`<th>${i(Se)}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${X.map(Se=>`<tr>${Se.map(sa=>`<td>${sa}</td>`).join("")}</tr>`).join("")}
        </tbody>
      </table>
    </div>
  `,V=(f,X,Se)=>`<span class="kc-machine-state ${f?"is-active":"is-inactive"}">${i(f?X:Se)}</span>`,N=f=>`
    <div class="kc-inline-badges kc-machine-freshness">
      ${m(f.status,f.status==="fresh"?"success":f.status==="cached"?"neutral":"warn")}
      ${y(f.updatedAt?T(f.updatedAt):"unknown time")}
      ${f.reason?y(f.reason):""}
    </div>
  `,Y=f=>`${f.status}${f.updatedAt?` · ${T(f.updatedAt)}`:""}${f.reason?` · ${f.reason}`:""}`,ia=f=>{const X=[f.fixCommand,f.hintCommand].filter(Boolean).join(" | ");return`
      <div class="kc-note-row">
        <div>
          <strong>${i(f.message)}</strong>
          <span>${i(f.reason??`section: ${f.section}`)}</span>
          <span>${i(f.impact)}</span>
        </div>
        <em class="${f.priority==="critical"?"tone-warn":""}">${i(X||f.priority)}</em>
      </div>
    `},bt=(f,X)=>`
    <div class="kc-stack-block">
      <p class="kc-stack-label">${i(f)}</p>
      <div class="kc-stack-list">
        ${X.map(Se=>ia(Se)).join("")}
      </div>
    </div>
  `;return`
    <div class="kc-view-shell">
      <section class="kc-view-header">
        <div>
          <p class="kc-view-kicker">Machine Advisory</p>
          <h1>Machine State</h1>
          <p>Machine setup guidance and repair commands. Repo-local Kiwi state still wins. Generated by ${i(l.generatedBy)}.</p>
        </div>
        ${m(l.stale?"stale":"fresh",l.stale?"warn":"success")}
      </section>

      <section class="kc-panel kc-panel-primary" data-render-section="machine-setup-readiness">
        <div class="kc-panel-heading">
          <div class="kc-panel-kicker">
            ${c(o("system"),"Setup Readiness")}
            ${m(C.overallStatus,C.overallTone==="success"?"success":"warn")}
          </div>
          <h1>${i(C.title)}</h1>
          <p>${i(C.detail)}</p>
        </div>
        <div class="kc-two-column">
          <section class="kc-subpanel">
            <div class="kc-stack-list">
              ${r(C.bestHeuristicLabel,C.bestHeuristicValue,"Heuristic completeness from inspected machine signals.")}
              ${r(C.strongestGapLabel,C.overallStatus,C.strongestGapDetail)}
            </div>
          </section>
          <section class="kc-subpanel">
            <div class="kc-stack-list">
              ${r(C.nextFixLabel,C.nextFixCommand,C.overallStatus==="stale"?"Refresh this first, then trust the detailed setup guidance below.":"Run this next to improve machine readiness or inspect the remaining gap.")}
            </div>
          </section>
        </div>
      </section>

      <div class="kc-stat-grid">
        ${v("Critical",String(l.systemHealth.criticalCount),"fix first",l.systemHealth.criticalCount>0?"critical":"neutral")}
        ${v("Warnings",String(l.systemHealth.warningCount),"recommended actions",l.systemHealth.warningCount>0?"warn":"neutral")}
        ${v("Healthy",String(l.systemHealth.okCount),"healthy checks","success")}
        ${v("Planning Heuristic",`${l.optimizationScore.planning.score}%`,`${l.optimizationScore.planning.earnedPoints}/${l.optimizationScore.planning.maxPoints} signal points`,"neutral")}
        ${v("Execution Heuristic",`${l.optimizationScore.execution.score}%`,`${l.optimizationScore.execution.earnedPoints}/${l.optimizationScore.execution.maxPoints} signal points`,"neutral")}
        ${v("Assistant Heuristic",`${l.optimizationScore.assistant.score}%`,`${l.optimizationScore.assistant.earnedPoints}/${l.optimizationScore.assistant.maxPoints} signal points`,"neutral")}
        ${v("Claude MCPs",String(l.mcpInventory.claudeTotal),"configured servers","neutral")}
        ${v("Codex MCPs",String(l.mcpInventory.codexTotal),"configured servers","neutral")}
        ${v("Copilot MCPs",String(l.mcpInventory.copilotTotal),"configured servers","neutral")}
        ${v("Skills",String(l.skillsCount),"agent skills in ~/.agents/skills","neutral")}
        ${v("Window",`${l.windowDays} days`,l.note,l.stale?"warn":"success")}
      </div>

      <section class="kc-panel">
        ${p("Setup Summary","Borrowed from ai-setup-style machine completion checks, but kept repo-local and read-only.")}
        <div class="kc-two-column">
          <section class="kc-subpanel">
            <div class="kc-stack-list">
              ${r("Installed tools",`${l.setupSummary.installedTools.readyCount}/${l.setupSummary.installedTools.totalCount}`,"Machine-local toolchain presence across the tracked inventory.")}
              ${r("Healthy configs",`${l.setupSummary.healthyConfigs.readyCount}/${l.setupSummary.healthyConfigs.totalCount}`,"Validated config and hook surfaces across Claude, Codex, and Copilot.")}
              ${r("Active token layers",String(l.setupSummary.activeTokenLayers.length),l.setupSummary.activeTokenLayers.length>0?l.setupSummary.activeTokenLayers.join(", "):"No token-optimization layers are currently active.")}
            </div>
          </section>
          <section class="kc-subpanel">
            <div class="kc-stack-list">
              ${r("Planning runtime",l.setupSummary.readyRuntimes.planning?"ready":"needs work",l.optimizationScore.planning.activeSignals.join(", ")||"No active planning signals detected.")}
              ${r("Execution runtime",l.setupSummary.readyRuntimes.execution?"ready":"needs work",l.optimizationScore.execution.activeSignals.join(", ")||"No active execution signals detected.")}
              ${r("Assistant runtime",l.setupSummary.readyRuntimes.assistant?"ready":"needs work",l.optimizationScore.assistant.activeSignals.join(", ")||"No active assistant signals detected.")}
            </div>
          </section>
        </div>
      </section>

      <section class="kc-panel">
        ${p("Optimization Heuristic","Heuristic completeness score calculated from inspected machine signals. This is advisory only and never overrides repo-local Kiwi state.")}
        <div class="kc-two-column">
          <section class="kc-subpanel">
            <div class="kc-stack-list">
              ${r("Planning",`${l.optimizationScore.planning.score}%`,`${l.optimizationScore.planning.earnedPoints}/${l.optimizationScore.planning.maxPoints} points · active: ${l.optimizationScore.planning.activeSignals.join(", ")||"none"}`)}
              ${r("Execution",`${l.optimizationScore.execution.score}%`,`${l.optimizationScore.execution.earnedPoints}/${l.optimizationScore.execution.maxPoints} points · active: ${l.optimizationScore.execution.activeSignals.join(", ")||"none"}`)}
              ${r("Assistant",`${l.optimizationScore.assistant.score}%`,`${l.optimizationScore.assistant.earnedPoints}/${l.optimizationScore.assistant.maxPoints} points · active: ${l.optimizationScore.assistant.activeSignals.join(", ")||"none"}`)}
            </div>
          </section>
          <section class="kc-subpanel">
            <div class="kc-stack-list">
              ${r("Planning gaps",String(l.optimizationScore.planning.missingSignals.length),l.optimizationScore.planning.missingSignals.join(", ")||"No planning gaps detected.")}
              ${r("Execution gaps",String(l.optimizationScore.execution.missingSignals.length),l.optimizationScore.execution.missingSignals.join(", ")||"No execution gaps detected.")}
              ${r("Assistant gaps",String(l.optimizationScore.assistant.missingSignals.length),l.optimizationScore.assistant.missingSignals.join(", ")||"No assistant gaps detected.")}
            </div>
          </section>
        </div>
      </section>

      <section class="kc-panel">
        ${p("Machine Setup Provenance","Structured provenance of the machine-local setup, grouped by phase.")}
        ${N(l.sections.setupPhases)}
        ${l.setupPhases.length>0?l.setupPhases.map(f=>`
              <div class="kc-stack-block">
                <p class="kc-stack-label">${i(f.phase)}</p>
                <div class="kc-stack-list">
                  ${f.items.map(X=>r(nt(X.name),X.active?"active":"inactive",`${La(X.name,X.description)} · ${Ia(X.location)}`)).join("")}
                </div>
              </div>
            `).join('<div class="kc-divider"></div>'):w("No machine-local setup provenance is available.")}
      </section>

      <section class="kc-panel">
        ${p("Config Health","Machine-level config and hook surfaces.")}
        ${N(l.sections.configHealth)}
        ${l.configHealth.length>0?q(["Config","Status","Description"],l.configHealth.map(f=>[i(f.path),V(f.healthy,"healthy","issue"),i(f.description)])):w("No config health data is available.")}
      </section>

      <section class="kc-panel">
        ${p(`Token Usage (Last ${l.windowDays} Days)`,"Measured usage from Claude and Codex local sources.")}
        ${N(l.sections.usage)}
        <div class="kc-two-column">
          <section class="kc-subpanel">
            ${p("Claude Code (via ccusage)",l.usage.claude.note)}
            <div class="kc-stack-list">
              ${r("Total",l.usage.claude.available?`${u(l.usage.claude.totals.totalTokens)} tokens`:"unavailable",l.usage.claude.totals.totalCost!=null?`cache ${d(l.usage.claude.totals.cacheHitRatio)} · cost ${b(l.usage.claude.totals.totalCost)}`:l.usage.claude.note)}
            </div>
            <div class="kc-divider"></div>
            ${l.usage.claude.days.length>0?q(["Date","Input","Output","Cache Read","Cost","Models"],l.usage.claude.days.map(f=>[i(f.date),i(u(f.inputTokens)),i(u(f.outputTokens)),i(u(f.cacheReadTokens)),i(b(f.totalCost)),i(f.modelsUsed.join(", ")||"—")])):w(l.usage.claude.note)}
          </section>
          <section class="kc-subpanel">
            ${p("Codex (via session logs)",l.usage.codex.note)}
            <div class="kc-stack-list">
              ${r("Total",l.usage.codex.available?`${u(l.usage.codex.totals.totalTokens)} tokens`:"unavailable",l.usage.codex.available?`cache ${d(l.usage.codex.totals.cacheHitRatio)} · sessions ${u(l.usage.codex.totals.sessions)}`:l.usage.codex.note)}
            </div>
            <div class="kc-divider"></div>
            ${l.usage.codex.days.length>0?q(["Date","Input","Output","Cached","Sessions"],l.usage.codex.days.map(f=>[i(f.date),i(u(f.inputTokens)),i(u(f.outputTokens)),i(u(f.cachedInputTokens)),i(u(f.sessions))])):w(l.usage.codex.note)}
          </section>
        </div>
        <div class="kc-divider"></div>
        <div class="kc-stack-list">
          ${r("Copilot CLI",l.usage.copilot.available?"available":"unavailable",l.usage.copilot.note)}
        </div>
      </section>

      <section class="kc-panel">
        ${p("Guidance","Assistive machine-local suggestions and repo hints. These are advisory only and never auto-applied.")}
        ${N(l.sections.guidance)}
        ${l.guidance.length>0?`
            ${D.critical.length>0?bt("Critical Issues",D.critical):""}
            ${D.recommended.length>0?bt("Improvements",D.recommended):""}
            ${D.optional.length>0?bt("Optional Optimizations",D.optional):""}
          `:w("No machine-local suggestions are currently recorded.")}
      </section>

      <section class="kc-panel">
        ${p("System Details","Expanded machine diagnostics for inspection mode.")}
        ${n==="inspection"?`
            <details class="kc-fold-card" open>
              <summary><strong>Toolchain inventory</strong><span>${i(Y(l.sections.inventory))}</span></summary>
              <div class="kc-fold-body">
                ${l.inventory.length>0?q(["Tool","Version","Phase","Status"],l.inventory.map(f=>[i(nt(f.name)),i(f.version),i(f.phase),V(f.installed,"installed","missing")])):w("No machine-local tool inventory is available.")}
              </div>
            </details>
            <details class="kc-fold-card">
              <summary><strong>MCP servers</strong><span>${i(Y(l.sections.mcpInventory))}</span></summary>
              <div class="kc-fold-body">
                <div class="kc-info-grid">
                  ${$("Planning runtime",u(l.mcpInventory.claudeTotal))}
                  ${$("Execution runtime",u(l.mcpInventory.codexTotal))}
                  ${$("Assistant runtime",u(l.mcpInventory.copilotTotal))}
                </div>
                <div class="kc-divider"></div>
                ${l.mcpInventory.tokenServers.length>0?q(["Server","Planning","Execution","Assistant"],l.mcpInventory.tokenServers.map(f=>[i(nt(f.name)),V(f.claude,"active","—"),V(f.codex,"active","—"),V(f.copilot,"active","—")])):w("No token-focused MCP inventory is available.")}
              </div>
            </details>
            <details class="kc-fold-card">
              <summary><strong>Optimization layers</strong><span>${i(Y(l.sections.optimizationLayers))}</span></summary>
              <div class="kc-fold-body">
                ${l.optimizationLayers.length>0?q(["Layer","Savings","Planning","Execution","Assistant"],l.optimizationLayers.map(f=>[i(nt(f.name)),i(f.savings),V(f.claude,"yes","no"),V(f.codex,"yes","no"),V(f.copilot,"yes","no")])):w("No optimization layer data is available.")}
              </div>
            </details>
            <details class="kc-fold-card">
              <summary><strong>Config health</strong><span>${i(Y(l.sections.configHealth))}</span></summary>
              <div class="kc-fold-body">
                ${l.configHealth.length>0?q(["Config","Status","Description"],l.configHealth.map(f=>[i(f.path),V(f.healthy,"healthy","issue"),i(f.description)])):w("No config health data is available.")}
              </div>
            </details>
          `:w("Switch to inspection mode to expand raw machine internals.")}
      </section>
    </div>
  `}function nt(e){const t=e.trim().toLowerCase();return t==="code-review-graph"?"Structural repo graph":t==="omc"?"Planning orchestration layer":t==="omx"?"Execution orchestration layer":t==="lean-ctx"?"Shell compression layer":t==="context-mode"?"Sandboxed context layer":t==="ccusage"?"Usage telemetry collector":t==="copilot"?"Assistant CLI":t==="ai-setup script"?"Machine bootstrap helper":t.startsWith("copilot plugins")?e.replace(/copilot plugins/i,"Assistant plugins"):e.replace(/[-_]/g," ")}function La(e,t){const n=e.trim().toLowerCase();return n==="code-review-graph"?"Structural repo search and graph-backed code lookup":n==="omc"?"Multi-agent planning and review orchestration":n==="omx"?"Multi-agent execution orchestration":n==="lean-ctx"?"Shell output compression for lower-noise local runs":n==="context-mode"?"Sandboxed tool output and context shaping":n==="ccusage"?"Machine-local usage telemetry source":n==="copilot"?"Editor assistant command-line surface":n==="ai-setup script"?"Machine bootstrap entrypoint":t}function Ia(e){return e.replace(/Claude Code/gi,"planning runtime").replace(/Codex/gi,"execution runtime").replace(/Copilot CLI/gi,"assistant runtime").replace(/~\/\.copilot/gi,"~/.assistant").replace(/~\/\.claude/gi,"~/.planner").replace(/~\/\.codex/gi,"~/.execution")}function Ea(e){var r;const{runtimeInfo:t,targetRoot:n,repoMode:a,machineSetup:i}=e;if(!(!n||a==="repo-not-initialized"||(t==null?void 0:t.runtimeMode)==="installed-user"&&!t.cli.installed||!!(i!=null&&i.needsAttention&&n)))return null;const o=[];n||o.push({id:"choose-repo",label:"Choose Repo",detail:"Pick the folder you want Kiwi Control to open and inspect."}),n&&a==="repo-not-initialized"&&o.push({id:"init-repo",label:"Initialize this repo",detail:"Create the repo-local Kiwi files for this folder, then start working from the app."}),n&&(i!=null&&i.needsAttention)&&o.push({id:"setup-machine",label:"Set up this machine",detail:i.detail,commandArgs:["--profile",i.recommendedProfile]}),n&&(t==null?void 0:t.runtimeMode)==="installed-user"&&t.cli.bundledInstallerAvailable&&!t.cli.installed&&o.push({id:"install-cli",label:"Install kc (optional)",detail:`Add kc to ${t.cli.installBinDir} if you want the power-user terminal path too.`});const c=t?`${Fa(t.runtimeMode)} · ${Ha(t.buildSource)} · v${t.appVersion}`:"Desktop shell is running, but runtime details are still loading.",m=t!=null&&t.cli.installed?`Installed at ${t.cli.installedCommandPath??t.cli.installBinDir}`:(t==null?void 0:t.runtimeMode)==="installed-user"?"Optional. Kiwi can install kc from the app if you want terminal access.":"Source/developer mode detected. Desktop use still works without a separate installed kc.",p=n?a==="repo-not-initialized"?`${n} needs repo-local initialization before normal work begins.`:`${n} is open in Kiwi Control.`:"No repo is open yet.",y=((r=o[0])==null?void 0:r.detail)??"Repo, CLI, and desktop setup are already aligned.";return{title:"Start in the app",intro:"Open Kiwi Control, choose a repo, initialize it if needed, and work. kc is optional and only needed if you also want the terminal path.",desktopStatus:c,cliStatus:m,repoStatus:p,nextAction:y,actions:o,note:(t==null?void 0:t.runtimeMode)==="installed-user"?"Desktop-first is the default path. Install kc only if you want the same repo flow from Terminal.":"Developer/source mode keeps the source checkout in control of desktop launching."}}function Na(e,t){const{escapeHtml:n,renderPanelHeader:a,renderNoteRow:i}=t;return`
    <section class="kc-panel kc-panel-primary" data-render-section="onboarding">
      ${a(e.title,e.intro)}
      <div class="kc-two-column">
        <section class="kc-subpanel">
          <div class="kc-stack-list">
            ${i("Desktop","Status",e.desktopStatus)}
            ${i("CLI","Status",e.cliStatus)}
            ${i("Repo","Status",e.repoStatus)}
            ${i("Next","Action",e.nextAction)}
          </div>
        </section>
        <section class="kc-subpanel">
          <div class="kc-stack-list">
            ${e.actions.length>0?e.actions.map(s=>`
                  <div class="kc-note-row">
                    <div>
                      <strong>${n(s.label)}</strong>
                      <span>${n(s.detail)}</span>
                    </div>
                    <button class="kc-secondary-button" type="button" data-onboarding-action="${n(s.id)}" ${s.commandArgs?`data-onboarding-command-args="${n(JSON.stringify(s.commandArgs))}"`:""} ${s.disabled?"disabled":""}>${n(s.label)}</button>
                  </div>
                `).join(""):i("Ready","No setup steps left",e.note)}
          </div>
        </section>
      </div>
      <p class="kc-section-note">${n(e.note)}</p>
    </section>
  `}function Fa(e){return e==="installed-user"?"Installed user mode":"Developer source mode"}function Ha(e){switch(e){case"installed-bundle":return"installed app";case"source-bundle":return"source bundle";default:return"fallback launcher"}}const Da=new Set(["plan","next","retry","resume","guide","review","prepare","validate","explain","trace","doctor","eval","init","status","check","sync","checkpoint","handoff","run","ui","dispatch","fanout","collect","reconcile","push-check"]);function Ne(e,t){const n=e==null?void 0:e.trim();if(!n)return"";const a=Va(n);if(a.length===0)return n;const[i="",s=""]=a;if(!["kiwi-control","kc","shrey-junior","sj"].includes(i))return n;const o=["kc",...a.slice(1)];return!t||t.trim().length===0||!Da.has(s)||a.includes("--target")?o.map(en).join(" "):[...o,"--target",t].map(en).join(" ")}function _a(e){return e.slice(0,6).map(t=>({title:t.file,metric:t.dependencyChain&&t.dependencyChain.length>1?"selected · chained":"selected",note:[t.selectionWhy??t.reasons.join(", "),t.dependencyChain&&t.dependencyChain.length>1?`chain: ${t.dependencyChain.join(" -> ")}`:null].filter(Boolean).join(" · ")}))}function ja(e){var s,o,c,m,p,y,r;if(!e.executionPlan.blocked&&((s=e.recoveryGuidance)==null?void 0:s.tone)!=="blocked")return[];const t=[],n=new Set,a=e.executionPlan.steps.find(w=>w.status==="failed")??e.executionPlan.steps[e.executionPlan.currentStepIndex]??null,i=(w,v,$)=>{const u=Ne(v,e.targetRoot);!u||n.has(u)||(n.add(u),t.push({title:w,command:u,detail:$}))};i(Oa((o=e.executionPlan.lastError)==null?void 0:o.fixCommand),((c=e.executionPlan.lastError)==null?void 0:c.fixCommand)??((m=e.recoveryGuidance)==null?void 0:m.nextCommand),((p=e.executionPlan.lastError)==null?void 0:p.reason)??((y=e.recoveryGuidance)==null?void 0:y.detail)??"Review the current workflow blocker before changing repo-local state."),a&&i(a.status==="failed"?`Re-run ${a.id}`:`Run ${a.id}`,a.command,a.validation||"Run the blocked workflow step again after reviewing the blocker."),i("Then retry",(r=e.executionPlan.lastError)==null?void 0:r.retryCommand,"Use this after the blocking issue is cleared.");for(const[w,v]of e.executionPlan.nextCommands.entries())i(w===0?"Continue with the next planned step":`Continue with planned step ${w+1}`,v,"Resume the remaining workflow once the blocker is resolved.");return t.slice(0,4)}function Oa(e){return e?/\bprepare\b/i.test(e)?"Refresh the prepared scope":/\bdoctor\b/i.test(e)?"Check the environment":/\bexplain\b/i.test(e)?"Inspect the blocker":"Fix the blocking issue":"Inspect the blocker"}function Va(e){return[...e.matchAll(/"([^"]*)"|'([^']*)'|`([^`]*)`|([^\s]+)/g)].map(n=>n[1]??n[2]??n[3]??n[4]??"").filter(Boolean)}function en(e){return/^[A-Za-z0-9_./:@%+=,-]+$/.test(e)?e:`"${e.replace(/(["\\$`])/g,"\\$1")}"`}function Sn(e,t){var n,a,i,s,o,c;return t.commandState.loading?{phase:"refreshing",visible:!0,label:"Running command",detail:t.commandState.activeCommand?`Executing ${t.commandState.activeCommand}...`:"Executing command...",progress:68,tone:"running",nextCommand:null}:t.isLoadingRepoState&&e.loadState.source!=="warm-snapshot"&&e.loadState.source!=="stale-snapshot"?{phase:"opening",visible:!0,label:t.currentLoadSource==="auto"?"Refreshing repo":"Opening repo",detail:t.currentLoadSource==="cli"?"Desktop launched. Kiwi is loading repo-local state now.":t.currentLoadSource==="auto"?"Refreshing repo-local state in the background.":"Building the repo-local control surface.",progress:t.currentLoadSource==="auto"?55:42,tone:"loading",nextCommand:null}:t.isRefreshingFreshRepoState&&Ka(e.loadState.source)?t.lastRepoLoadFailure?{phase:"degraded",visible:!0,label:((n=t.recoveryGuidance)==null?void 0:n.title)??"Using cached snapshot",detail:((a=t.recoveryGuidance)==null?void 0:a.detail)??`Fresh repo-local state could not be loaded: ${t.lastRepoLoadFailure}`,progress:74,tone:((i=t.recoveryGuidance)==null?void 0:i.tone)==="blocked"?"blocked":"degraded",nextCommand:((s=t.recoveryGuidance)==null?void 0:s.nextCommand)??null}:{phase:"warm_loaded",visible:!0,label:e.loadState.source==="stale-snapshot"?"Older snapshot loaded":"Warm state loaded",detail:e.loadState.detail,progress:e.loadState.source==="stale-snapshot"?58:64,tone:"warm",nextCommand:((o=t.recoveryGuidance)==null?void 0:o.nextCommand)??null}:t.recoveryGuidance&&(t.recoveryGuidance.tone==="blocked"||t.recoveryGuidance.tone==="failed")?{phase:t.recoveryGuidance.tone==="failed"?"failed":"ready",visible:!0,label:t.recoveryGuidance.title,detail:t.recoveryGuidance.detail,progress:t.recoveryGuidance.tone==="failed"?100:96,tone:t.recoveryGuidance.tone==="failed"?"degraded":"blocked",nextCommand:t.recoveryGuidance.nextCommand}:e.loadState.source==="bridge-fallback"?{phase:"failed",visible:!0,label:e.readiness.label,detail:t.lastRepoLoadFailure??e.readiness.detail,progress:18,tone:e.readiness.tone==="failed"?"degraded":"blocked",nextCommand:e.readiness.nextCommand}:t.lastReadyStateSignal&&Date.now()-t.lastReadyStateSignal.at<t.readyStatePulseMs?{phase:"ready",visible:!0,label:e.readiness.label,detail:t.machineHydrationInFlight?`${t.lastReadyStateSignal.detail} ${t.machineHydrationDetail}`:e.readiness.detail,progress:100,tone:e.readiness.tone==="blocked"?"blocked":e.readiness.tone==="failed"?"degraded":"ready",nextCommand:e.readiness.nextCommand}:t.currentTargetRoot&&t.machineHydrationInFlight?{phase:"refreshing",visible:!0,label:e.readiness.label,detail:e.readiness.tone==="blocked"?e.readiness.detail:`${e.readiness.detail} ${t.machineHydrationDetail}`,progress:88,tone:e.readiness.tone==="blocked"?"blocked":e.readiness.tone==="failed"?"degraded":"ready",nextCommand:e.readiness.nextCommand}:t.currentTargetRoot&&t.isMachineHeavyViewActive&&t.machineAdvisoryStale?{phase:"warm_loaded",visible:!0,label:"System data deferred",detail:"Kiwi keeps heavy machine diagnostics off the startup path and hydrates them when this view is active.",progress:66,tone:"warm",nextCommand:null}:{phase:t.currentTargetRoot?"ready":"opening",visible:!1,label:"",detail:"",progress:100,tone:"ready",nextCommand:((c=t.recoveryGuidance)==null?void 0:c.nextCommand)??null}}function Ba(e,t){const n=Sn(e,t);return n.visible?{label:n.label,detail:n.detail}:e.targetRoot?{label:e.readiness.label,detail:e.readiness.detail}:{label:"opening",detail:"Run kc ui inside a repo to load it automatically."}}function za(e){if(!e.targetRoot)return"Run kc ui inside a repo to load it automatically.";switch(e.repoState.mode){case"healthy":return"Repo-local state is loaded and ready.";case"repo-not-initialized":return"This folder is not initialized yet. Run kc init in Terminal to get started.";case"initialized-invalid":return"This repo needs repair before continuity is fully trustworthy.";case"initialized-with-warnings":return"Repo is usable with a few warnings worth addressing.";case"bridge-unavailable":default:return"Confirm kiwi-control works in Terminal, then run kc ui again."}}function Ua(e,t){if(e.readiness.detail)return e.readiness.detail;const a=`Fresh repo-local state is ready for ${Ce(e.targetRoot||t)}.`;switch(e.repoState.mode){case"healthy":return a;case"initialized-invalid":return`${a} The repo is loaded, but workflow execution is still blocked until the repo contract is repaired.`;case"repo-not-initialized":return`${a} This repo still needs kc init before the normal workflow can continue.`;case"initialized-with-warnings":return`${a} The repo is usable, but Kiwi still sees warning-level issues worth addressing.`;case"bridge-unavailable":default:return a}}function Ga(e,t,n){if(!e.targetRoot)return n.activeTargetHint;if(e.repoState.mode==="bridge-unavailable")return"Confirm kiwi-control works in Terminal, then run kc ui again.";if(n.recoveryGuidance){const a=n.recoveryGuidance.nextCommand?` Do this now: ${n.recoveryGuidance.nextCommand}.`:"";return`${n.recoveryGuidance.detail}${a} ${n.activeTargetHint}`}if(e.readiness.detail){const a=e.readiness.nextCommand?` Do this now: ${e.readiness.nextCommand}.`:"";return`${e.readiness.detail}${a} ${n.activeTargetHint}`}return n.lastReadyStateSignal&&Date.now()-n.lastReadyStateSignal.at<n.readyStatePulseMs?n.machineHydrationInFlight?`${n.lastReadyStateSignal.detail} ${n.machineHydrationDetail} ${n.activeTargetHint}`:`${n.lastReadyStateSignal.detail} ${n.activeTargetHint}`:e.loadState.source==="stale-snapshot"?`Showing ${Ce(e.targetRoot)} from an older snapshot while Kiwi refreshes current repo-local state. ${n.activeTargetHint}`:e.loadState.source==="warm-snapshot"?`Showing ${Ce(e.targetRoot)} from a recent warm snapshot while fresh repo-local state refreshes. ${n.activeTargetHint}`:n.machineHydrationInFlight?`Fresh repo-local state is ready for ${Ce(e.targetRoot)}. ${n.machineHydrationDetail} ${n.activeTargetHint}`:t==="cli"?`Loaded ${Ce(e.targetRoot)} from kc ui. ${n.activeTargetHint}`:t==="manual"?`Loaded ${Ce(e.targetRoot)}. ${n.activeTargetHint}`:t==="auto"?`Refreshed ${Ce(e.targetRoot)}. ${n.activeTargetHint}`:n.activeTargetHint}function Ka(e){return e==="warm-snapshot"||e==="stale-snapshot"}function Ce(e){const t=e.trim();if(!t)return"repo";const n=t.split(/[\\/]/).filter(Boolean);return n[n.length-1]??t}function Wa(e){const t=new Set(Ja(e.focusPath,e.selectedAnalysis)),n={path:e.rootPath,label:e.rootLabel||"repo",kind:"root",status:"selected",baseX:600,baseY:360,x:600,y:360,radius:34,tone:"tone-root",importance:"high",highlighted:t.has(e.rootPath)},a=[n],i=[],s=[],o=e.tree.nodes.slice(0,10);return o.forEach((c,m)=>{const p=Math.PI*2*m/Math.max(o.length,1),y=600+Math.cos(p)*220,r=360+Math.sin(p)*220,w=tn(c,e.selectedAnalysis),v={path:c.path,label:c.name,kind:c.kind,status:c.status,baseX:y,baseY:r,x:y,y:r,radius:w==="high"?26:w==="medium"?22:18,tone:`tone-${c.status}`,importance:w,highlighted:t.has(c.path)};a.push(v),i.push({fromPath:n.path,toPath:v.path,highlighted:t.has(n.path)&&t.has(v.path)}),s.push({label:c.name,kind:c.kind,meta:`${c.children.length} child nodes`,path:c.path}),!(e.graphDepth<2)&&c.children.slice(0,e.graphDepth>2?6:4).forEach(($,u)=>{const d=p+(u-1.5)*.32,b=v.baseX+Math.cos(d)*160,T=v.baseY+Math.sin(d)*160,l=tn($,e.selectedAnalysis),C={path:$.path,label:$.name,kind:$.kind,status:$.status,baseX:b,baseY:T,x:b,y:T,radius:l==="high"?18:l==="medium"?16:14,tone:`tone-${$.status}`,importance:l,highlighted:t.has($.path)};a.push(C),i.push({fromPath:v.path,toPath:C.path,highlighted:t.has(v.path)&&t.has(C.path)}),s.push({label:$.name,kind:$.kind,meta:$.status,path:$.path})})}),{rootPath:e.rootPath,nodes:a,edges:i,summary:s,nodesByPath:new Map(a.map(c=>[c.path,c]))}}function qa(e,t){const n=e.nodes.map(s=>{const o=t.get(s.path)??{x:0,y:0};return{path:s.path,label:s.label,kind:s.kind,status:s.status,x:s.baseX+o.x,y:s.baseY+o.y,radius:s.radius,tone:s.tone,importance:s.importance,highlighted:s.highlighted}}),a=new Map(n.map(s=>[s.path,s])),i=e.edges.map(s=>{const o=a.get(s.fromPath),c=a.get(s.toPath);return{fromPath:s.fromPath,toPath:s.toPath,from:{x:(o==null?void 0:o.x)??0,y:(o==null?void 0:o.y)??0},to:{x:(c==null?void 0:c.x)??0,y:(c==null?void 0:c.y)??0},highlighted:s.highlighted}});return{nodes:n,edges:i,summary:e.summary}}function yt(e,t,n){const a=e.nodesByPath.get(n);if(!a)return null;const i=t.get(n)??{x:0,y:0};return{x:a.baseX+i.x,y:a.baseY+i.y}}function Ja(e,t){var o;if(!e)return[];const n=(o=t.find(c=>c.file===e))==null?void 0:o.dependencyChain;if(n&&n.length>1)return n;const a=e.split(/[\\/]/).filter(Boolean),i=[];let s=e.startsWith("/")?"/":"";for(const c of a)s=s?`${s.replace(/\/$/,"")}/${c}`:c,i.push(s);return i}function tn(e,t){var a;const n=t.find(i=>i.file===e.path);return e.status==="selected"||((n==null?void 0:n.score)??0)>=2||(((a=n==null?void 0:n.dependencyChain)==null?void 0:a.length)??0)>1?"high":e.status==="candidate"||e.children.some(i=>i.status==="selected")?"medium":"low"}const Pt=[{id:"overview",label:"Overview",icon:F("overview")},{id:"context",label:"Context",icon:F("context")},{id:"graph",label:"Graph",icon:F("graph")},{id:"tokens",label:"Tokens",icon:F("tokens")},{id:"feedback",label:"Feedback",icon:F("feedback")},{id:"mcps",label:"MCPs",icon:F("mcps")},{id:"specialists",label:"Specialists",icon:F("specialists")},{id:"system",label:"System",icon:F("system")},{id:"validation",label:"Validation",icon:F("validation")},{id:"machine",label:"Machine",icon:F("system")}],Ya="Confirm kiwi-control works in Terminal, then run kc ui again.",Cn=4500,Rn=180,Pn=["inventory","configHealth","mcpInventory"],Xa=["guidance","optimizationLayers","setupPhases","usage"],j={contextView:{task:null,selectedFiles:[],excludedPatterns:[],reason:null,confidence:null,confidenceDetail:null,keywordMatches:[],tree:{nodes:[],selectedCount:0,candidateCount:0,excludedCount:0},timestamp:null},tokenAnalytics:{selectedTokens:0,fullRepoTokens:0,savingsPercent:0,fileCountSelected:0,fileCountTotal:0,estimationMethod:null,estimateNote:null,topDirectories:[],task:null,timestamp:null},efficiency:{instructionsGenerated:!1,instructionsPath:null},nextActions:{actions:[],summary:""},feedback:{totalRuns:0,successRate:0,adaptationLevel:"limited",note:"Adaptive feedback is idle.",basedOnPastRuns:!1,reusedPattern:null,similarTasks:[],recentEntries:[],topBoostedFiles:[],topPenalizedFiles:[]},execution:{totalExecutions:0,totalTokensUsed:0,averageTokensPerRun:0,successRate:0,recentExecutions:[],tokenTrend:"insufficient-data"},wastedFiles:{files:[],totalWastedTokens:0,removalSavingsPercent:0},heavyDirectories:{directories:[]},indexing:{totalFiles:0,observedFiles:0,selectedFiles:0,candidateFiles:0,excludedFiles:0,discoveredFiles:0,analyzedFiles:0,skippedFiles:0,skippedDirectories:0,visitedDirectories:0,maxDepthExplored:0,fileBudgetReached:!1,directoryBudgetReached:!1,partialScan:!1,ignoreRulesApplied:[],skipped:[],indexedFiles:0,indexUpdatedFiles:0,indexReusedFiles:0,impactFiles:0,changedSignals:0,keywordSignals:0,importSignals:0,repoContextSignals:0,scopeArea:null,coverageNote:"Run kiwi-control prepare to record indexing coverage and selection reasoning.",selectionReason:null},fileAnalysis:{totalFiles:0,scannedFiles:0,skippedFiles:0,selectedFiles:0,excludedFiles:0,selected:[],excluded:[],skipped:[]},contextTrace:{initialSignals:{changedFiles:[],recentFiles:[],importNeighbors:[],proximityFiles:[],keywordMatches:[],repoContextFiles:[]},expansionSteps:[],honesty:{heuristic:!0,lowConfidence:!1,partialScan:!1}},tokenBreakdown:{partialScan:!1,categories:[]},decisionLogic:{summary:"",decisionPriority:"low",inputSignals:[],reasoningChain:[],ignoredSignals:[]},runtimeLifecycle:{currentTask:null,currentStage:"idle",validationStatus:null,nextSuggestedCommand:null,nextRecommendedAction:null,recentEvents:[]},executionEvents:{source:"unavailable",latestRevision:null,recentEvents:[]},measuredUsage:{available:!1,source:"none",totalTokens:0,totalRuns:0,runs:[],workflows:[],files:[],note:"No measured token usage is available yet."},skills:{activeSkills:[],suggestedSkills:[],totalSkills:0},workflow:{task:null,status:"pending",currentStepId:null,steps:[]},executionTrace:{steps:[],whyThisHappened:""},executionPlan:{summary:"",state:"idle",currentStepIndex:0,confidence:null,risk:"low",blocked:!1,steps:[],nextCommands:[],lastError:null},repoIntelligence:{reviewPackAvailable:!1,reviewPackPath:null,reviewPackSummary:null}},Re=document.querySelector("#app"),nn=document.querySelector("#boot-overlay");if(!Re)throw new Error("App root not found");let E="overview",he="history",_e="all",se=!1,Fe=!1,ft=!1,g=qt(""),Me=Za(),ee="execution";const an=ei(),Qa=1e3;let Tt,Tn,ne,Et,re,ut,At,Mt,S="",ae=!1,ue=!1,Te=null,st=null,An="",pt=0,ze=!1,fe=new Set,Nt=new Set,ot=null,ie=null,Mn=0,Q=null,Ue=!1,rt=!1,ge=null,He=null,Be=!1,Ft=0,sn="",Ht=null,on="",at=null,k={activeCommand:null,loading:!1,composer:null,draftValue:"",lastResult:null,lastError:null},ce=null,I=null,pe=new Map,Ge=[],ke=new Map,be={x:0,y:0},ve=1,oe=2,Le=null,B=null,Z=[],ye=new Set,Ie=new Map,Oe=null,we="",Dt=new Map,de=0,K=null,te=null,Xe=null,ct=!1,lt=new Set,Pe=null,$t=!1,mt=!1;function je(){ft||(Fe=Sa(E,ee))}var $n;try{Re.innerHTML=ti(),Tt=me(".kc-shell"),Tn=me("#rail-nav"),ne=me("#bridge-note"),Et=me("#topbar"),re=me("#center-main"),ut=me("#inspector"),At=me("#log-drawer"),Mt=me("#workspace-surface"),rn(),H(g),ne.textContent=kt(g,"shell"),Ln(),Re.addEventListener("click",e=>{const t=e.target;if(!t)return;const n=e,a=t.closest("[data-view]");if(a!=null&&a.dataset.view){const c=a.dataset.view;c!==E&&(E=c,mt=!0,je()),M(),jt(E,!1);return}if(t.closest("[data-toggle-logs]")){se=!se,M();return}if(t.closest("[data-toggle-inspector]")){ft=!0,Fe=!Fe,M();return}const i=t.closest("[data-log-tab]");if(i!=null&&i.dataset.logTab){he=i.dataset.logTab,M();return}const s=t.closest("[data-validation-tab]");if(s!=null&&s.dataset.validationTab){_e=s.dataset.validationTab,M();return}if(t.closest("[data-theme-toggle]")){Me=Me==="dark"?"light":"dark",rn(),M();return}const o=t.closest("[data-ui-mode]");if(o!=null&&o.dataset.uiMode){ee=o.dataset.uiMode,ee==="execution"&&(se=!1,he="history"),je(),M();return}Ni(n,t)||t.closest("[data-reload-state]")&&S&&Ze(S,"manual")}),Re.addEventListener("input",e=>{const t=e.target;if(t){if(t.matches("[data-command-draft]")){k.draftValue=t.value;return}t.matches("[data-plan-edit-input]")&&(we=t.value)}}),Re.addEventListener("change",e=>{const t=e.target;t&&t.matches("[data-command-draft]")&&(k.draftValue=t.value)}),Re.addEventListener("wheel",e=>{const t=e.target;if(!t||!t.closest("[data-graph-surface]"))return;e.preventDefault(),Ve();const n=e.deltaY>0?-.12:.12;ve=Math.max(.65,Math.min(2.4,Number((ve+n).toFixed(2)))),mn()||Lt()},{passive:!1}),Re.addEventListener("pointerdown",e=>{const t=e.target;if(!t)return;const n=t.closest("[data-graph-node]");if(n!=null&&n.dataset.path){Ve(),B={mode:"drag-node",path:n.dataset.path,lastClientX:e.clientX,lastClientY:e.clientY};return}t.closest("[data-graph-surface]")&&(Ve(),B={mode:"pan",lastClientX:e.clientX,lastClientY:e.clientY})}),window.addEventListener("pointermove",e=>{if(!B)return;const t=e.clientX-B.lastClientX,n=e.clientY-B.lastClientY;if(Ve(),B.mode==="pan"){be={x:be.x+t,y:be.y+n},B.lastClientX=e.clientX,B.lastClientY=e.clientY,mn()||Lt();return}const a=ke.get(B.path)??{x:0,y:0};ke.set(B.path,{x:a.x+t/ve,y:a.y+n/ve}),B.lastClientX=e.clientX,B.lastClientY=e.clientY,hn(B.path)}),window.addEventListener("pointerup",()=>{(B==null?void 0:B.mode)==="drag-node"&&(Ve(),hn(B.path)),B=null,Be&&Ee()}),window.addEventListener("keydown",e=>{const t=document.activeElement;if(!(t instanceof HTMLInputElement||t instanceof HTMLTextAreaElement||t instanceof HTMLSelectElement)){if(e.altKey&&e.key.toLowerCase()==="g"){e.preventDefault(),_("guide",[],{expectJson:!0});return}if(e.altKey&&e.key.toLowerCase()==="n"){e.preventDefault(),_("next",[],{expectJson:!0});return}if(e.altKey&&e.key.toLowerCase()==="v"){e.preventDefault(),_("validate",[],{expectJson:!0});return}e.altKey&&e.key==="Enter"&&(e.preventDefault(),_("run-auto",[Bt("run-auto")],{expectJson:!1}))}}),ni()}catch(e){const t=e instanceof Error?`${e.name}: ${e.message}
${e.stack??""}`:String(e);console.error(t),($n=window.__KIWI_BOOT_API__)==null||$n.renderError(`Synchronous renderer boot failure:
${t}`)}function me(e){const t=document.querySelector(e);if(!t)throw new Error(`Shell mount point not found: ${e}`);return t}function Za(){try{const e=window.localStorage.getItem("kiwi-control-theme");if(e==="dark"||e==="light")return e}catch{}return"dark"}function Ln(){const e=window.__KIWI_BOOT_API__;window.requestAnimationFrame(()=>{var n,a,i;if(!(!!((n=Et.textContent)!=null&&n.trim())||!!((a=re.textContent)!=null&&a.trim())||!!((i=ut.textContent)!=null&&i.trim()))){e==null||e.renderError("Renderer mounted but produced no visible UI content.");return}e&&(e.mounted=!0),e==null||e.hide(),zt(g)})}function ei(){const e=navigator.userAgent.toLowerCase();return e.includes("win")?"windows":e.includes("mac")?"macos":"linux"}function rn(){Tt.dataset.theme=Me,Tt.dataset.platform=an,document.documentElement.dataset.theme=Me,document.documentElement.dataset.platform=an;try{window.localStorage.setItem("kiwi-control-theme",Me)}catch{}}function ti(){return`
    <main class="kc-shell">
      <header class="kc-topbar" id="topbar"></header>
      <div class="kc-main-frame">
        <aside class="kc-rail">
          <div class="kc-rail-brand">
            <div class="kc-logo">K</div>
          </div>
          <nav class="kc-rail-nav" id="rail-nav"></nav>
          <div class="kc-rail-footer" id="bridge-note"></div>
        </aside>
        <section class="kc-workspace">
          <div class="kc-workspace-surface" id="workspace-surface">
            <div class="kc-main-stack">
              <div class="kc-view-scroll" id="center-main"></div>
              <section class="kc-log-drawer" id="log-drawer"></section>
            </div>
            <aside class="kc-inspector" id="inspector"></aside>
          </div>
        </section>
      </div>
    </main>
  `}async function ni(){if(await ii())return;await In(),await si();const e=await na();e?(await J("ui-initial-launch-request-consumed",e.requestId,e.targetRoot),await gt(e)):await J("ui-initial-launch-request-missing"),window.setInterval(()=>{li()},250),window.setInterval(()=>{oi()},Qa),window.setInterval(()=>{Fi()},250)}function ai(){if(O())return null;const e=new URLSearchParams(window.location.search),t=e.get("preview");return t?{fixturePath:e.get("fixture")??`/preview/${t}.json`}:null}async function ii(){const e=ai();if(!e)return!1;const t=await fetch(e.fixturePath,{cache:"no-store"});if(!t.ok)throw new Error(`Preview fixture failed to load: ${e.fixturePath}`);const n=await t.json();return g=n.state,S=n.state.targetRoot,ie=n.runtimeInfo??null,n.activeView&&(E=n.activeView),n.activeMode&&(ee=n.activeMode),ft=!1,je(),ne.textContent=n.state.repoState.detail,H(n.state),vt(`Preview loaded for ${n.activeView??"overview"}.`),!0}async function si(){if(O())try{await Qt("desktop-launch-request",e=>{gt(e.payload)}),await Qt("repo-state-changed",e=>{_t(e.payload)})}catch{}}async function _t(e){if(!(!e.targetRoot||e.targetRoot!==S)&&!(e.revision<=g.executionState.revision)){if(ae||ue||k.loading){st=e;return}await Ze(e.targetRoot,"auto",void 0,{preferSnapshot:!1})}}async function oi(){if(!(!S||!O()||ae||ue))try{const e=await G("get_latest_runtime_revision",{targetRoot:S,afterRevision:g.executionState.revision});e>g.executionState.revision&&await _t({targetRoot:S,revision:e})}catch{}}async function In(){if(O())try{ie=await G("get_desktop_runtime_info");const e=qn(ie.renderProbeView);e&&(E=e),M()}catch{ie=null}}async function ri(){if(!(!O()||k.loading)){k.loading=!0,k.activeCommand=null,k.lastError=null,k.lastResult=null,H(g);try{const e=await G("install_bundled_cli");await In(),k.lastResult={ok:!0,exitCode:0,stdout:e.detail,stderr:"",commandLabel:"install kc"}}catch(e){k.lastError=e instanceof Error?e.message:String(e)}finally{k.loading=!1,H(g)}}}async function ci(){if(!(!O()||k.loading))try{const e=await G("pick_repo_directory");if(!e)return;await Ze(e,"manual",void 0,{preferSnapshot:!1})}catch(e){k.lastError=e instanceof Error?e.message:String(e),H(g)}}async function gt(e){if(await J("ui-launch-request-received",e.requestId,e.targetRoot),An=e.requestId,ae){Te=e,await J("ui-launch-request-queued",e.requestId,e.targetRoot);return}if(S.trim().length>0&&e.targetRoot===S&&g.repoState.mode!=="bridge-unavailable"&&!ue){await J("ui-launch-request-attached",e.requestId,e.targetRoot,g.loadState.source),await Wt(S,g.executionState.revision),ne.textContent=kt(g,"cli"),vt(Kt(g)),H(g),await Ke(e.requestId,S,cn(g.loadState.source)?"hydrating":"ready",cn(g.loadState.source)?`Already attached to ${S}. Fresh repo-local state is still hydrating.`:`Already attached to ${S}. Kiwi reused the active runtime-backed desktop session.`,g.executionState.revision);return}await Ze(e.targetRoot,"cli",e.requestId)}async function li(){if(ae||!O())return;const e=await na();!e||e.requestId===An||(await J("ui-fallback-launch-request-consumed",e.requestId,e.targetRoot),await gt(e))}async function Ze(e,t,n,a={}){if(ae||ue){n&&(Te={requestId:n,targetRoot:e});return}ae=!0,ot=t,S=e,Q=null,Ht=null,ce=null,ne.textContent=t==="cli"?`Opening ${e} from ${n?"kc ui":"the CLI"}...`:t==="auto"?`Refreshing repo-local state for ${e}...`:`Loading repo-local state for ${e}...`,H(g);try{const i=await aa(e,a.preferSnapshot??!1);if(S=i.targetRoot||e,g=i,Mn=Date.now(),await Wt(S,i.executionState.revision),H(i),ne.textContent=kt(i,t),await J("ui-repo-state-rendered",n,i.targetRoot||e,`${i.repoState.mode}:${i.loadState.source}`),(i.loadState.source==="warm-snapshot"||i.loadState.source==="stale-snapshot")&&t!=="auto"){ae=!1,ot=null,ue=!0,H(g),n&&await Ke(n,S,"hydrating",i.loadState.source==="stale-snapshot"?`Loaded an older repo snapshot for ${S}. Fresh repo-local state is still hydrating.`:`Loaded a warm repo snapshot for ${S}. Fresh repo-local state is still hydrating.`),window.setTimeout(()=>{di(S,n)},32);return}Hn(!1),vt(Kt(i)),M(),n&&await Ke(n,S,i.repoState.mode==="bridge-unavailable"?"error":"ready")}catch(i){if(Q=i instanceof Error?i.message:String(i),(t==="auto"||t==="manual")&&g.targetRoot===e&&g.repoState.mode!=="bridge-unavailable"){ne.textContent=`Kiwi kept the last known repo-local state for ${e}. Refresh failed: ${Q}`,H(g),await J("ui-repo-state-retained-after-refresh-failure",n,e,Q);return}const o=qt(e);g=o,S=o.targetRoot||e,ne.textContent=`Kiwi could not load repo-local state for ${e}. ${Q}`,H(o),await J("ui-repo-state-failed",n,e,Q),n&&await Ke(n,e,"error",Q)}finally{ae=!1,ot=null,ue||(await En(n),await Nn())}}async function di(e,t){try{const n=await aa(e,!1);S=n.targetRoot||e,g=n,Mn=Date.now(),Q=null,await Wt(S,n.executionState.revision),Kn()?Ee():H(n),ne.textContent=kt(n,"manual"),await J("ui-repo-state-refreshed",t,S,n.repoState.mode),Hn(!1),vt(Kt(n)),Ee(),t&&await Ke(t,S,n.repoState.mode==="bridge-unavailable"?"error":"ready")}catch(n){Q=n instanceof Error?n.message:String(n),ne.textContent=`Showing a warm repo snapshot for ${e}. Fresh refresh failed: ${Q}`,await J("ui-repo-state-refresh-failed",t,e,Q),Ee()}finally{ue=!1,await En(t),await Nn()}}async function En(e){if(Te&&Te.requestId!==e){const t=Te;Te=null,await gt(t);return}Te=null}async function Nn(){if(!st)return;const e=st;st=null,await _t(e)}async function Ke(e,t,n,a,i=g.executionState.revision){const s=a??(n==="ready"?`Loaded repo-local state for ${t}.`:n==="hydrating"?`Loaded a warm repo snapshot for ${t}. Fresh repo-local state is still hydrating.`:Ya);if(O())try{await J("ui-ack-attempt",e,t,n),await G("ack_launch_request",{requestId:e,targetRoot:t,status:n,detail:s,revision:i}),await J("ui-ack-succeeded",e,t,n)}catch(o){ne.textContent="Kiwi Control loaded this repo, but the desktop launch acknowledgement did not complete yet.",await J("ui-ack-failed",e,t,o instanceof Error?o.message:String(o))}}async function J(e,t,n,a){if(O())try{await G("append_ui_launch_log",{event:e,requestId:t,targetRoot:n,detail:a})}catch{}}function cn(e){return e==="warm-snapshot"||e==="stale-snapshot"}function Fn(e){return e==="machine"||e==="tokens"||e==="mcps"||e==="system"}function ui(e){return[...new Set(e)]}function pi(e){switch(e){case"tokens":return["usage","optimizationLayers"];case"mcps":return["mcpInventory","optimizationLayers"];case"system":return["inventory","configHealth","setupPhases"];case"machine":return["guidance","inventory","configHealth"];default:return Pn}}function mi(e){return Fn(e)?ui([...Pn,...Xa]):[]}function ln(e,t){return e.filter(n=>{var a;return Nt.has(n)?((a=g.machineAdvisory.sections[n])==null?void 0:a.status)!=="fresh":!0})}function jt(e,t){if(!S||!O())return;const n=ln(pi(e)),a=ln(mi(e).filter(s=>!n.includes(s))),i=++pt;ge!=null&&(window.clearTimeout(ge),ge=null),n.length>0&&dn(t,n,i),a.length>0&&(ge=window.setTimeout(()=>{dn(t,a,i),ge=null},900))}function Hn(e){jt(E,e)}async function dn(e,t,n){if(!(!O()||t.length===0)){ze=!0;for(const a of t)fe.add(a);if(M(),await Promise.all(t.map(a=>hi(a,e,n))),n!==pt){for(const a of t)fe.delete(a);fe.size===0&&(ze=!1),M();return}for(const a of t)fe.delete(a);fe.size===0&&(ze=!1),M()}}async function hi(e,t,n){try{const a=await G("load_machine_advisory_section",{section:e,refresh:t});if(n!==pt)return;fi(a),Nt.add(e),Ee()}catch(a){if(n!==pt)return;g.machineAdvisory.sections[e]={status:"partial",updatedAt:new Date().toISOString(),reason:a instanceof Error?a.message:String(a)},Ee()}}function fi(e){switch(g.machineAdvisory.sections[e.section]=e.meta,e.section){case"inventory":g.machineAdvisory.inventory=e.data;break;case"mcpInventory":g.machineAdvisory.mcpInventory=e.data;break;case"optimizationLayers":g.machineAdvisory.optimizationLayers=e.data;break;case"setupPhases":g.machineAdvisory.setupPhases=e.data;break;case"configHealth":g.machineAdvisory.configHealth=e.data;break;case"usage":g.machineAdvisory.usage=e.data;break;case"guidance":g.machineAdvisory.guidance=gi(e.data);break}g.machineAdvisory.updatedAt=e.meta.updatedAt,g.machineAdvisory.stale=Object.values(g.machineAdvisory.sections).some(t=>t.status!=="fresh"),g.machineAdvisory.systemHealth=vi(g.machineAdvisory)}function gi(e){var c,m,p,y,r,w;const t=((m=(c=g.kiwiControl)==null?void 0:c.contextView.task)==null?void 0:m.toLowerCase())??"",n=((p=g.kiwiControl)==null?void 0:p.workflow.currentStepId)??null,a=g.validation.errors>0,i=(((y=g.kiwiControl)==null?void 0:y.feedback.totalRuns)??0)>0&&(((r=g.kiwiControl)==null?void 0:r.feedback.successRate)??100)<50,s=((w=g.kiwiControl)==null?void 0:w.workflow.steps.some(v=>v.retryCount>0))??!1,o=a||i||s;return e.filter(v=>!(!o&&v.priority!=="critical"||(/\b(read|inspect|review|summarize)\b/.test(t)||/\bdocs?|document|readme\b/.test(t))&&n==="prepare"&&v.id==="missing-ccusage"))}function vi(e){const t=e.guidance.filter(i=>i.priority==="critical").length,n=e.guidance.filter(i=>i.priority==="recommended").length,a=e.inventory.filter(i=>i.installed).length+e.configHealth.filter(i=>i.healthy).length+e.optimizationLayers.filter(i=>i.claude||i.codex||i.copilot).length;return{criticalCount:t,warningCount:n,okCount:a}}function ki(e){const t=e.targetRoot||"";t!==sn&&(sn=t,k={activeCommand:null,loading:!1,composer:null,draftValue:"",lastResult:null,lastError:null},ce=null,I=null,pe=new Map,Ge=[],ke=new Map,be={x:0,y:0},ve=1,oe=2,Le=null,Z=[],ye=new Set,Ie=new Map,Oe=null,we="",Dt=new Map,de=0,K=null,te=null,Xe=null,lt.clear(),ct=!1,Nt.clear(),fe.clear(),ze=!1,ft=!1,je(),ge!=null&&(window.clearTimeout(ge),ge=null)),yi(e),bi(e)}function bi(e){const t=I;if((t==null?void 0:t.kind)==="path"&&!wt(E))I=null;else if((t==null?void 0:t.kind)==="step"&&!xt(E))I=null;else{if((t==null?void 0:t.kind)==="path"&&Vn(e,t.path))return;if((t==null?void 0:t.kind)==="step"&&Qe(e).some(s=>s.id===t.id))return}if(!wt(E)&&!xt(E)){I=null;return}const a=jn(e)[0];if(a&&wt(E)){I={kind:"path",id:a,label:Je(a),path:a};return}const i=Qe(e)[0];if(i&&xt(E)){I={kind:"step",id:i.id,label:i.displayTitle};return}I=null}function wt(e){return e==="overview"||e==="context"||e==="graph"}function xt(e){return e==="overview"}function yi(e){const t=(e.kiwiControl??j).executionPlan.steps.map(n=>n.id);if(t.length===0){Z=[],ye.clear(),Ie.clear(),Oe=null,we="";return}Z.length===0?Z=[...t]:Z=[...Z.filter(n=>t.includes(n)),...t.filter(n=>!Z.includes(n))];for(const n of[...ye])t.includes(n)||ye.delete(n);for(const n of[...Ie.keys()])t.includes(n)||Ie.delete(n)}function et(e){const t=(e.kiwiControl??j).contextView.tree;if(K&&K.baseTree===t&&K.overrideVersion===de)return K.tree;const n=t.nodes.map(s=>Dn(s)),a=_n(n),i={nodes:n,selectedCount:a.selected,candidateCount:a.candidate,excludedCount:a.excluded};return K={baseTree:t,overrideVersion:de,tree:i,flatNodes:Ot(n)},i}function Dn(e){const t=pe.get(e.path),n=t==null?e.status:t==="include"?"selected":"excluded";return{...e,status:n,children:e.children.map(a=>Dn(a))}}function _n(e){return e.reduce((t,n)=>{n.status==="selected"?t.selected+=1:n.status==="candidate"?t.candidate+=1:t.excluded+=1;const a=_n(n.children);return t.selected+=a.selected,t.candidate+=a.candidate,t.excluded+=a.excluded,t},{selected:0,candidate:0,excluded:0})}function jn(e){return On(e).filter(t=>t.kind==="file"&&t.status==="selected").map(t=>t.path)}function Ot(e){return e.flatMap(t=>[t,...Ot(t.children)])}function On(e){const t=(e.kiwiControl??j).contextView.tree;return K&&K.baseTree===t&&K.overrideVersion===de?K.flatNodes:(et(e),(K==null?void 0:K.flatNodes)??[])}function Vn(e,t){return On(e).find(n=>n.path===t)??null}function Vt(){Ge.push(new Map(pe)),Ge.length>20&&Ge.shift()}function St(e,t){Vt(),pe.set(e,t),de+=1,K=null,I={kind:"path",id:e,label:Je(e),path:e},Le=e,M()}function $i(){pe.size!==0&&(Vt(),pe.clear(),de+=1,K=null,M())}function wi(){const e=Ge.pop();e&&(pe=new Map(e),de+=1,K=null,M())}function Bt(e){var n,a,i,s;if(e==="handoff")return g.specialists.handoffTargets[0]??g.specialists.recommendedSpecialist??"";if(e==="checkpoint")return $e(g.repoOverview,"Current phase")!=="none recorded"?$e(g.repoOverview,"Current phase"):`${Gt(S)} checkpoint`;const t=((a=(n=g.kiwiControl)==null?void 0:n.contextView.task)==null?void 0:a.trim())??"";return t&&t.toLowerCase()!=="task"?t:((s=(i=g.kiwiControl)==null?void 0:i.nextActions.actions[0])==null?void 0:s.action)??""}function Bn(e){const t=(e==null?void 0:e.trim().toLowerCase())??"";return t.length===0||t==="task"}function zn(e,t,n){var o,c,m,p;const a=(o=e.kiwiControl)==null?void 0:o.executionPlan,i=a==null?void 0:a.steps.find(y=>y.id==="validate"),s=((c=e.runtimeDecision.recovery)==null?void 0:c.fixCommand)??e.runtimeDecision.nextCommand??e.executionState.nextCommand??e.readiness.nextCommand??(i==null?void 0:i.fixCommand)??(i==null?void 0:i.retryCommand)??((m=a==null?void 0:a.lastError)==null?void 0:m.fixCommand)??((p=a==null?void 0:a.lastError)==null?void 0:p.retryCommand)??(a==null?void 0:a.nextCommands[0])??'kiwi-control validate "task"';return t==="run-auto"&&Bn(n)?{blocked:!0,reason:"Enter a real goal instead of the placeholder task.",nextCommand:'kiwi-control prepare "real goal"'}:t==="checkpoint"&&(e.executionState.lifecycle==="blocked"||e.executionState.lifecycle==="failed"||(i==null?void 0:i.status)==="failed"||e.validation.errors>0)?{blocked:!0,reason:"Checkpoint is blocked until validation passes.",nextCommand:s}:t==="handoff"&&(e.executionState.lifecycle==="blocked"||e.executionState.lifecycle==="failed"||(i==null?void 0:i.status)==="failed"||e.validation.errors>0)?{blocked:!0,reason:"Handoff is blocked until validation passes.",nextCommand:s}:{blocked:!1,reason:t==="run-auto"?"Run a concrete goal in the loaded repo.":"Ready to run.",nextCommand:null}}function un(e){k.loading||(ce=null,k.composer===e?(k.composer=null,k.draftValue=""):(k.composer=e,k.draftValue=Bt(e)),M())}async function Un(){S&&await Ze(S,"manual",void 0,{preferSnapshot:!1})}async function _(e,t,n){if(!S||k.loading||!O())return null;k.loading=!0,k.activeCommand=e,k.lastError=null,k.lastResult=null,ce=null,H(g);try{const a=await G("run_cli_command",{command:e,args:t,targetRoot:S,expectJson:n.expectJson});return k.lastResult=a,k.lastError=a.ok?null:Gn(a),se=!0,a.ok?(k.composer=null,k.draftValue="",await Un()):H(g),a}catch(a){const i=a instanceof Error?a.message:String(a);return await xi(e,t)?k.lastError=`Opened Terminal to run ${e} because desktop subprocess execution failed: ${i}`:k.lastError=i,se=!0,H(g),null}finally{k.loading=!1,k.activeCommand=null,H(g)}}async function pn(e,t){if(!S||k.loading||!O())return null;k.loading=!0,k.activeCommand="status",k.lastError=null,k.lastResult=null,ce=null,H(g);try{const a=await G("run_cli_command",{command:"pack",args:e==="set"&&t?[e,t,"--json"]:[e,"--json"],targetRoot:S,expectJson:!0});return k.lastResult=a,k.lastError=a.ok?null:Gn(a),se=!0,a.ok?await Un():H(g),a}catch(n){return k.lastError=n instanceof Error?n.message:String(n),se=!0,H(g),null}finally{k.loading=!1,k.activeCommand=null,H(g)}}async function xi(e,t){if(!S||!O())return!1;try{return await G("open_terminal_command",{command:e,args:t,targetRoot:S}),!0}catch{return!1}}async function Ct(e){if(!(!S||!O()))try{await G("open_path",{targetRoot:S,path:e})}catch(t){k.lastError=t instanceof Error?t.message:String(t),H(g)}}function Gn(e){const t=e.jsonPayload;if(t&&typeof t=="object"&&!Array.isArray(t)){const n=t,a=typeof n.failureReason=="string"?n.failureReason.trim():"",i=typeof n.validation=="string"?n.validation.trim():"",s=typeof n.detail=="string"?n.detail.trim():"",o=typeof n.nextCommand=="string"?n.nextCommand.trim():typeof n.nextSuggestedCommand=="string"?n.nextSuggestedCommand.trim():"",c=a||i||s;if(c)return o?`${c} Next: ${Ne(o,S)}`:c}return e.stderr||e.stdout||`${e.commandLabel} failed`}function vt(e){Ht={at:Date.now(),detail:e},at!=null&&window.clearTimeout(at),at=window.setTimeout(()=>{at=null,Ee()},Cn+32)}function Ve(){Ft=Date.now()}function Kn(){return E==="graph"&&Date.now()-Ft<Rn}function Ee(){if(!Kn()){Be=!1,He!=null&&(window.clearTimeout(He),He=null),M();return}if(Be=!0,He!=null)return;const e=Math.max(0,Rn-(Date.now()-Ft));He=window.setTimeout(()=>{He=null,Be&&(Be=!1,M())},e+16)}function Si(){return Pe!=null&&Pe.isConnected||(Pe=re.querySelector("[data-graph-viewport]")),Pe}function mn(){if(E!=="graph")return!1;const e=Si();return e?(e.setAttribute("transform",`translate(${be.x} ${be.y}) scale(${ve})`),!0):!1}function hn(e){lt.add(e),!(ct||Ue||rt)&&(ct=!0,window.requestAnimationFrame(()=>{ct=!1;const t=[...lt];lt.clear(),Ci(t)||Lt()}))}function Ci(e){if(E!=="graph"||e.length===0)return!1;const t=Xe??Wn(g);if(!t)return!1;const n=re.querySelector("[data-graph-canvas-root]");if(!n)return!1;for(const a of e){const i=`[data-graph-node-wrap][data-path="${We(a)}"]`,s=n.querySelector(i),o=yt(t,ke,a);s&&o&&s.setAttribute("transform",`translate(${o.x}, ${o.y})`);const c=[`[data-graph-edge][data-from-path="${We(a)}"]`,`[data-graph-edge][data-to-path="${We(a)}"]`].join(",");for(const m of n.querySelectorAll(c)){const p=m.dataset.fromPath,y=m.dataset.toPath;if(!p||!y)continue;const r=yt(t,ke,p),w=yt(t,ke,y);!r||!w||(m.setAttribute("x1",String(r.x)),m.setAttribute("y1",String(r.y)),m.setAttribute("x2",String(w.x)),m.setAttribute("y2",String(w.y)))}}return!0}function We(e){return typeof CSS<"u"&&typeof CSS.escape=="function"?CSS.escape(e):e.replace(/["\\]/g,"\\$&")}function qe(e){const t=Ri(e);if(t.length<2)return null;const n=t[0]??"";if(!["kiwi-control","kc","shrey-junior","sj"].includes(n))return null;const[a="",...i]=t.slice(1);if(a==="run"&&i[0]==="--auto"){const s=i.find((o,c)=>c>0&&o!=="--target"&&o!==S);return s?{command:"run-auto",args:[s]}:null}if(a==="handoff"){const s=i.findIndex(c=>c==="--to"),o=s>=0?i[s+1]:void 0;if(o)return{command:"handoff",args:[o]}}if(a==="checkpoint"){const s=i.find(o=>!o.startsWith("--"));return s?{command:"checkpoint",args:[s]}:null}if(a==="validate"){const s=i.find(o=>!o.startsWith("--")&&o!==S);return{command:"validate",args:s?[s]:[]}}if(a==="review"){const s=[],o=i.findIndex(m=>m==="--base"),c=o>=0?i[o+1]:void 0;return c&&!c.startsWith("--")&&s.push("--base",c),i.includes("--json")&&s.push("--json"),{command:"review",args:s}}return a==="init"?{command:"init",args:[]}:a==="sync"?{command:"sync",args:i.filter(o=>o==="--dry-run"||o==="--diff-summary"||o==="--backup")}:a==="setup"?{command:"setup",args:i.filter(o=>o==="--dry-run"||o==="--json"||o==="--profile"||["desktop-only","desktop-plus-cli","repo-only","repair","full-dev-machine"].includes(o)||["status","verify","doctor","repair","install","init"].includes(o)||["global-cli","global-preferences","lean-ctx","repomix","repo-contract","repo-assistant-wiring","repo-graph","repo-hygiene"].includes(o))}:["guide","next","retry","resume","status","trace"].includes(a)?{command:a,args:i.includes("--json")?["--json"]:[]}:null}function Ri(e){return[...e.matchAll(/"([^"]*)"|'([^']*)'|`([^`]*)`|([^\s]+)/g)].map(n=>n[1]??n[2]??n[3]??n[4]??"").filter(Boolean)}async function Pi(e){const t=qe(e.command);if(t){await _(t.command,t.args,{expectJson:t.args.includes("--json")});return}if(e.retryCommand){const n=qe(e.retryCommand);if(n){await _(n.command,n.args,{expectJson:n.args.includes("--json")});return}}if(e.id==="execute"){await _("run-auto",[Bt("run-auto")],{expectJson:!1});return}if(e.id.includes("validate")){await _("validate",[],{expectJson:!0});return}await _("next",["--json"],{expectJson:!0})}function Qe(e){const t=(e.kiwiControl??j).executionPlan,n=new Map(t.steps.map(a=>[a.id,a]));return Z.map(a=>n.get(a)).filter(a=>!!a).map(a=>{var s,o;const i=Ie.get(a.id);return{...a,displayTitle:((s=i==null?void 0:i.label)==null?void 0:s.trim())||a.description,displayNote:((o=i==null?void 0:i.note)==null?void 0:o.trim())||a.result.summary||a.expectedOutput||null,skipped:ye.has(a.id)}})}function fn(e,t){const n=Z.indexOf(e),a=n+t;if(n<0||a<0||a>=Z.length)return;const i=[...Z],s=i[n],o=i[a];!s||!o||(i[n]=o,i[a]=s,Z=i,M())}function Ti(e){ye.has(e)?ye.delete(e):ye.add(e),M()}function Ai(e,t){Oe=e,we=t,M()}function Mi(e){const t=Ie.get(e)??{label:"",note:""};Ie.set(e,{...t,label:we.trim()||t.label}),Oe=null,we="",M()}function Wn(e){var o;const t=et(e),n=e.targetRoot||"repo",a=Le??((I==null?void 0:I.kind)==="path"?I.path:null),i=((o=e.kiwiControl)==null?void 0:o.fileAnalysis.selected)??[];if(te&&te.baseTree===t&&te.overrideVersion===de&&te.targetRoot===n&&te.graphDepth===oe&&te.focusPath===a&&te.selectedAnalysis===i)return Xe=te.projection,te.projection;const s=Wa({tree:t,rootPath:n,rootLabel:Gt(n)||"repo",graphDepth:oe,focusPath:a,selectedAnalysis:i});return te={baseTree:t,overrideVersion:de,targetRoot:n,graphDepth:oe,focusPath:a,selectedAnalysis:i,projection:s},Xe=s,s}function Li(e){return qa(Wn(e),ke)}function Je(e){const t=e.split(/[\\/]/).filter(Boolean);return t[t.length-1]??e}function Ii(e,t){const n=e.tone==="blocked"?"blocked":"warn",a=E==="overview"?"A recovery path is active. Use the repo-scoped command below.":e.detail;return`
    <div class="kc-view-shell">
      <section class="kc-panel kc-command-banner tone-${n}" data-render-section="command-banner">
        <div class="kc-command-banner-head">
          <div>
            <p class="kc-section-micro">${h(t.kicker)}</p>
            <strong>${h(e.title)}</strong>
          </div>
          <span class="kc-load-badge"><span class="kc-load-dot"></span>${h(e.tone)}</span>
        </div>
        <p>${h(a)}</p>
        <div class="kc-command-banner-actions">
          ${e.nextCommand?`<code class="kc-command-chip">${h(Ne(e.nextCommand,S))}</code>`:""}
          ${e.followUpCommand?`<code class="kc-command-chip">${h(Ne(e.followUpCommand,S))}</code>`:""}
          ${t.actionLabel?`<button class="kc-secondary-button" type="button" data-reload-state>${h(t.actionLabel)}</button>`:""}
        </div>
      </section>
    </div>
  `}function Ei(){var a,i,s,o;if(ce)return Ii(ce,{kicker:"Action blocked"});if(!k.lastResult&&!k.lastError)return"";const e=k.lastError?"warn":(a=k.lastResult)!=null&&a.ok?"success":"warn",t=k.lastError?"Last command failed":(i=k.lastResult)!=null&&i.ok?"Last command completed":"Last command reported an issue",n=k.lastError??((s=k.lastResult)==null?void 0:s.stderr)??((o=k.lastResult)==null?void 0:o.stdout)??"No command detail was recorded.";return`
    <div class="kc-view-shell">
      <section class="kc-panel kc-command-banner tone-${e}" data-render-section="command-banner">
        <div class="kc-command-banner-head">
          <div>
            <p class="kc-section-micro">Command Result</p>
            <strong>${h(t)}</strong>
          </div>
          ${k.lastResult?`<code class="kc-command-chip">${h(k.lastResult.commandLabel)}</code>`:""}
        </div>
        <p>${h(n)}</p>
      </section>
    </div>
  `}function Ni(e,t){var v,$;const n=t.closest("[data-onboarding-action]");if(n!=null&&n.dataset.onboardingAction){const u=n.dataset.onboardingAction,d=(()=>{const b=n.dataset.onboardingCommandArgs;if(!b)return[];try{const T=JSON.parse(b);return Array.isArray(T)?T.filter(l=>typeof l=="string"):[]}catch{return[]}})();return u==="install-cli"?ri():u==="choose-repo"?ci():u==="init-repo"&&S?_("init",[],{expectJson:!1}):u==="setup-machine"&&_("setup",d,{expectJson:!1}),!0}const a=t.closest("[data-ui-command]");if(a!=null&&a.dataset.uiCommand){const u=a.dataset.uiCommand;if(u==="run-auto"||u==="checkpoint"||u==="handoff")un(u);else if(u==="retry"){const d=(($=(v=g.kiwiControl)==null?void 0:v.executionPlan.lastError)==null?void 0:$.retryCommand)??"",b=d?qe(d):null;b?_(b.command,b.args,{expectJson:b.args.includes("--json")}):_("retry",[],{expectJson:!1})}else _(u,gn(u)?["--json"]:[],{expectJson:gn(u)});return!0}const i=t.closest("[data-direct-command]");if(i!=null&&i.dataset.directCommand){const u=qe(i.dataset.directCommand);return u?_(u.command,u.args,{expectJson:u.args.includes("--json")}):(k.lastError=`Kiwi could not run this desktop action directly: ${i.dataset.directCommand}`,H(g)),!0}const s=t.closest("[data-pack-action]");if(s!=null&&s.dataset.packAction){const u=s.dataset.packAction;if(u==="clear")return pn("clear"),!0;if(u==="set"&&s.dataset.packId)return pn("set",s.dataset.packId),!0}const o=t.closest("[data-composer-submit]");if(o!=null&&o.dataset.composerSubmit){const u=o.dataset.composerSubmit,d=k.draftValue.trim(),b=zn(g,u,d);return b.blocked?(ce=ra(u,b.reason,b.nextCommand),k.lastError=null,M(),!0):d?(_(u==="run-auto"?"run-auto":u==="checkpoint"?"checkpoint":"handoff",[d],{expectJson:!1}),!0):(k.lastError=`${u} requires a value before running.`,ce=null,M(),!0)}if(t.closest("[data-composer-cancel]"))return k.composer=null,k.draftValue="",ce=null,M(),!0;const c=t.closest("[data-tree-action]");if(c!=null&&c.dataset.treeAction&&c.dataset.path){e.preventDefault(),e.stopPropagation();const u=c.dataset.path,d=c.dataset.treeAction;return d==="open"?Ct(u):d==="focus"?(I={kind:"path",id:u,label:Je(u),path:u},Le=u,M()):St(u,d),!0}const m=t.closest("[data-tree-bulk]");if(m!=null&&m.dataset.treeBulk){const u=et(g),d=Ot(u.nodes).map(b=>b.path);if(m.dataset.treeBulk==="reset")$i();else if(m.dataset.treeBulk==="undo")wi();else{Vt();for(const b of d)pe.set(b,m.dataset.treeBulk);de+=1,K=null,M()}return!0}const p=t.closest("[data-graph-node]");if(p!=null&&p.dataset.path){const u=p.dataset.path;return I={kind:"path",id:u,label:Je(u),path:u},Le=u,e.detail>1&&p.dataset.kind==="file"&&Ct(u),M(),!0}const y=t.closest("[data-graph-action]");if(y!=null&&y.dataset.graphAction){const u=y.dataset.path,d=y.dataset.graphAction;if(d==="depth-up")oe=Math.min(3,oe+1);else if(d==="depth-down")oe=Math.max(1,oe-1);else if(d==="reset-view")be={x:0,y:0},ve=1,ke.clear();else if(u)if(d==="open")Ct(u);else return d==="focus"?(I={kind:"path",id:u,label:Je(u),path:u},Le=u,M(),!0):(St(u,d),!0);return M(),!0}const r=t.closest("[data-plan-action]");if(r!=null&&r.dataset.planAction&&r.dataset.stepId){const u=r.dataset.stepId,d=Qe(g).find(b=>b.id===u);if(!d)return!0;switch(r.dataset.planAction){case"run":Pi(d);break;case"retry":if(d.retryCommand){const b=qe(d.retryCommand);b?_(b.command,b.args,{expectJson:b.args.includes("--json")}):_("retry",[],{expectJson:!1})}else _("retry",[],{expectJson:!1});break;case"skip":Ti(u);break;case"edit":Ai(u,d.displayTitle);break;case"edit-save":Mi(u);break;case"edit-cancel":Oe=null,we="",M();break;case"move-up":fn(u,-1);break;case"move-down":fn(u,1);break;case"focus":I={kind:"step",id:d.id,label:d.displayTitle},M();break}return!0}const w=t.closest("[data-inspector-action]");if(w!=null&&w.dataset.inspectorAction){const u=w.dataset.inspectorAction;if(u==="approve"||u==="reject"){const d=I==null?void 0:I.id;return d&&Dt.set(d,u==="approve"?"approved":"rejected"),M(),!0}if(u==="add-to-context"&&(I==null?void 0:I.kind)==="path")return St(I.path,"include"),!0;if(u==="validate")return _("validate",[],{expectJson:!0}),!0;if(u==="handoff")return un("handoff"),!0}return!1}function gn(e){return["guide","next","validate","status","trace"].includes(e)}function qn(e){if(!e)return null;const t=e.trim().toLowerCase();return Pt.some(n=>n.id===t)?t:null}function zt(e){var r,w,v,$,u;if(!O())return;const t=!!(nn&&!nn.classList.contains("is-hidden")),n=Xn(e),a=[...document.querySelectorAll("[data-render-section]")].map(d=>d.dataset.renderSection??"").filter(d=>d.length>0),i=[...document.querySelectorAll("[data-ui-command]")].map(d=>d.dataset.uiCommand??"").filter(d=>d.length>0),s=[...document.querySelectorAll('[data-pack-action="set"][data-pack-id]')].map(d=>d.dataset.packId??"").filter(d=>d.length>0),o=document.querySelectorAll(".kc-log-body .kc-log-line").length,c=(r=e.kiwiControl)==null?void 0:r.executionPlan,m=e.runtimeDecision.currentStepId??((w=c==null?void 0:c.steps[c.currentStepIndex])==null?void 0:w.id)??((v=e.kiwiControl)==null?void 0:v.workflow.currentStepId)??null,p={mounted:!!(($=window.__KIWI_BOOT_API__)!=null&&$.mounted),bootVisible:t,activeView:E,activeMode:ee,targetRoot:e.targetRoot,settledOnTarget:!!((u=window.__KIWI_BOOT_API__)!=null&&u.mounted)&&!t&&e.targetRoot===S&&!ae,selectedPack:e.mcpPacks.selectedPack.id,selectedPackSource:e.mcpPacks.selectedPackSource,aiSetupDetected:e.machineAdvisory.inventory.some(d=>d.name==="ai-setup"&&d.installed),machineSetupStatus:e.machineAdvisory.stale?"stale":e.machineAdvisory.systemHealth.criticalCount>0||e.machineAdvisory.setupSummary.healthyConfigs.readyCount<e.machineAdvisory.setupSummary.healthyConfigs.totalCount||e.machineAdvisory.setupSummary.installedTools.readyCount<e.machineAdvisory.setupSummary.installedTools.totalCount?"needs-work":"ready",selectablePackIds:s,packCatalog:e.mcpPacks.available.map(d=>({id:d.id,executable:d.executable,unavailablePackReason:d.unavailablePackReason})),repoMode:e.repoState.mode,executionState:e.executionState.lifecycle,executionRevision:e.executionState.revision,inspectorOpen:Fe,mainScrollTop:Math.round((re==null?void 0:re.scrollTop)??0),historyLineCount:o,onboardingActions:[...document.querySelectorAll("[data-onboarding-action]")].map(d=>d.dataset.onboardingAction??"").filter(d=>d.length>0),currentStep:m,loadPhase:n.phase,loadLabel:n.label,loadDetail:n.detail,visibleSections:a,visibleCommands:i},y=JSON.stringify(p);y!==on&&(on=y,G("write_render_probe",{payload:p}).catch(()=>{}))}async function Fi(){if(!(!O()||$t)){$t=!0;try{const e=await G("consume_render_action");if(!e)return;if(e.actionType==="click-pack"&&e.packId){const t=document.querySelector(`[data-pack-action="set"][data-pack-id="${We(e.packId)}"]`);if(t){t.click();return}const n=document.querySelector(`[data-pack-card="true"][data-pack-id="${We(e.packId)}"] summary`);n==null||n.click();return}if(e.actionType==="clear-pack"){const t=document.querySelector('[data-pack-action="clear"]');t==null||t.click();return}if(e.actionType==="switch-view"&&e.view){const t=qn(e.view);t&&t!==E&&(E=t,mt=!0,je()),M(),jt(E,!1);return}if(e.actionType==="switch-mode"&&e.mode){ee=e.mode,ee==="execution"&&(se=!1,he="history"),je(),M();return}e.actionType==="set-main-scroll"&&typeof e.y=="number"&&(re.scrollTop=e.y,zt(g))}catch{}finally{$t=!1}}}function H(e){var t;g=e,ki(e),Tn.innerHTML=Hi(),Et.innerHTML=Di(e),Jn(e),ut.innerHTML=ss(e),At.innerHTML=rs(e),Mt.classList.toggle("is-inspector-open",Fe),Mt.classList.toggle("is-log-open",se),ut.classList.toggle("is-hidden",!Fe),At.classList.toggle("is-hidden",!se),mt&&(re.scrollTop=0,mt=!1),(t=window.__KIWI_BOOT_API__)!=null&&t.mounted||Ln(),zt(e)}function Jn(e){re.innerHTML=`${Ei()}${Vi(e)}`,Pe=null,E!=="graph"&&(Xe=null)}function M(){Ue||(Ue=!0,window.requestAnimationFrame(()=>{Ue=!1,H(g)}))}function Lt(){rt||Ue||(rt=!0,window.requestAnimationFrame(()=>{rt=!1,Jn(g)}))}function Hi(){const e=Pt.filter(a=>a.id==="overview"||a.id==="context"),t=Pt.filter(a=>a.id!=="overview"&&a.id!=="context"),n=a=>`
    <button class="kc-rail-button ${a.id===E?"is-active":""}" data-view="${a.id}" type="button">
      <span class="kc-rail-icon">${a.icon}</span>
      <span class="kc-rail-label">${h(a.label)}</span>
    </button>
  `;return`
    <div class="kc-rail-group">
      <span class="kc-rail-group-label">Main</span>
      ${e.map(n).join("")}
    </div>
    <div class="kc-rail-group kc-rail-group-secondary">
      <span class="kc-rail-group-label">Inspect</span>
      ${t.map(n).join("")}
    </div>
  `}function Di(e){var v,$,u,d,b,T;const t=ji(e),n=Gt(e.targetRoot),a=$e(e.repoOverview,"Current phase"),i=$e(e.repoOverview,"Validation state"),s=xa({state:{projectType:e.projectType,executionMode:e.executionMode,validationState:i,decision:t}}),o=$a({loadStatus:Xn(e),activeView:E}),c=Me==="dark"?"Light mode":"Dark mode",m=((v=e.kiwiControl)==null?void 0:v.contextView.task)??((u=($=e.kiwiControl)==null?void 0:$.nextActions.actions[0])==null?void 0:u.action)??"",p=!!((d=e.runtimeDecision.recovery)!=null&&d.retryCommand)||!!S,y=k.composer?zn(e,k.composer,k.draftValue):null,r=Pa({nextActionLabel:((b=e.runtimeDecision.nextAction)==null?void 0:b.action)??t.nextAction,nextCommand:((T=e.runtimeDecision.nextAction)==null?void 0:T.command)??e.runtimeDecision.nextCommand,retryEnabled:p,hasTask:!!m,handoffAvailable:e.specialists.handoffTargets.length>0}),w=ie?`${ie.runtimeMode==="installed-user"?"desktop":"source"} · ${ie.buildSource}`:e.runtimeIdentity?`runtime · ${e.runtimeIdentity.packagingSourceCategory}`:null;return ha({state:e,repoLabel:n,phase:a,topMetadata:s,primaryBanner:o,actionCluster:r,runtimeBadge:w,themeLabel:c,activeTheme:Me,activeMode:ee,isLogDrawerOpen:se,isInspectorOpen:Fe,currentTargetRoot:S,commandState:k,composerConstraint:y,helpers:tt()})}function _i(){const e=fe.size;return e===0?"Refreshing machine-local diagnostics in the background.":`Refreshing ${[...fe].map(n=>{switch(n){case"mcpInventory":return"MCP inventory";case"optimizationLayers":return"optimization layers";case"setupPhases":return"setup phases";case"configHealth":return"config health";default:return n}}).join(", ")}${e>1?" in the background":""}.`}function Yn(e){return oa(e,{lastRepoLoadFailure:Q})}function Ut(e){return{commandState:{loading:k.loading,activeCommand:k.activeCommand},currentLoadSource:ot,currentTargetRoot:S,isLoadingRepoState:ae,isRefreshingFreshRepoState:ue,lastRepoLoadFailure:Q,lastReadyStateSignal:Ht,readyStatePulseMs:Cn,machineHydrationInFlight:ze,machineHydrationDetail:_i(),activeTargetHint:za(e),recoveryGuidance:Yn(e),isMachineHeavyViewActive:Fn(E),machineAdvisoryStale:e.machineAdvisory.stale}}function Xn(e){return Sn(e,Ut(e))}function ji(e){return ya(e,{isLoadingRepoState:ae,isRefreshingFreshRepoState:ue,hasWarmSnapshot:e.loadState.source==="warm-snapshot"||e.loadState.source==="stale-snapshot",formatTimestamp:le})}function Oi(e,t){return`
    <div class="kc-inline-meta">
      <span>${h(e)}</span>
      <strong>${h(t)}</strong>
    </div>
  `}function tt(){return{escapeHtml:h,escapeAttribute:Jt,iconSvg:F,iconLabel:ea,formatCliCommand:Ne,renderHeaderBadge:W,renderHeaderMeta:Oi,renderPanelHeader:x,renderInlineBadge:U,renderNoteRow:P,renderEmptyState:A,renderStatCard:L,renderInfoRow:R,renderListBadges:Ye,renderExplainabilityBadge:dt,renderGateRow:Qn,renderBulletRow:xe,deriveSignalImpact:ls,formatInteger:ta,formatPercent:vs,formatCurrency:ks,formatTimestamp:le,formatTokensShort:z}}function Vi(e){switch(E){case"context":return Ui(e);case"graph":return Gi(e);case"tokens":return qi(e);case"feedback":return is(e);case"mcps":return Ji(e);case"specialists":return ts(e);case"system":return ns(e);case"validation":return Ki(e);case"machine":return as(e);case"overview":default:return zi(e)}}function Bi(e){return Ba(e,Ut(e))}function zi(e){var v,$,u;const t=e.kiwiControl??j,n=et(e),a=Bi(e),i=Yn(e),s=Ne((v=t.nextActions.actions[0])==null?void 0:v.command,e.targetRoot),o=$e(e.continuity,"Current focus"),c=(($=e.specialists.activeProfile)==null?void 0:$.name)??e.specialists.activeSpecialist,m=t.contextView.task??"No prepared task",p=wa({state:{repoTitle:e.repoState.title,repoDetail:e.repoState.detail,nextActionSummary:t.nextActions.summary,primaryAction:t.nextActions.actions[0]??null},currentFocus:o,primaryActionCommand:s}),y=_a(t.fileAnalysis.selected),r=ja({targetRoot:e.targetRoot,recoveryGuidance:i,executionPlan:t.executionPlan}),w=Ea({runtimeInfo:ie,targetRoot:e.targetRoot,repoMode:e.repoState.mode,machineSetup:{needsAttention:e.machineAdvisory.stale||e.machineAdvisory.systemHealth.criticalCount>0||e.machineAdvisory.setupSummary.healthyConfigs.readyCount<e.machineAdvisory.setupSummary.healthyConfigs.totalCount||e.machineAdvisory.setupSummary.installedTools.readyCount<e.machineAdvisory.setupSummary.installedTools.totalCount,recommendedProfile:ie!=null&&ie.cli.installed?"desktop-only":"desktop-plus-cli",detail:e.machineAdvisory.stale?"Refresh and apply Kiwi-managed machine setup before trusting deeper machine guidance.":"Apply Kiwi-managed machine setup and repo wiring with one guided flow."}});return`
    <div class="kc-view-shell">
      <section class="kc-panel kc-panel-primary" data-render-section="overview-primary-hero">
        <div class="kc-panel-heading">
          <div class="kc-panel-kicker">
            ${ea(F("overview"),"Next Action")}
            ${W(p.badgeLabel,p.badgeTone)}
          </div>
          <h1>${h(p.title)}</h1>
          <p>${h(p.detail)}</p>
        </div>
        <div class="kc-primary-footer">
          ${p.command?`<code class="kc-command-chip">${h(p.command)}</code>`:""}
          <span>${h(p.supportingText)}</span>
        </div>
      </section>

      ${w?Na(w,tt()):""}

      <div class="kc-stat-grid">
        ${L("Repo State",e.repoState.title,e.validation.ok?"ready to use":`${e.validation.errors+e.validation.warnings} issues`,e.validation.ok?"success":"warn")}
        ${L("Task",m,t.contextView.confidenceDetail??"current working set","neutral")}
        ${L("Selected Files",String(n.selectedCount),"current bounded context","neutral")}
        ${L("Lifecycle",e.executionState.lifecycle,a.detail,e.executionState.lifecycle==="blocked"||e.executionState.lifecycle==="failed"?"warn":"neutral")}
      </div>

      ${r.length>0?`
          <section class="kc-panel" data-render-section="blocked-workflow-fix">
            ${x("How To Unblock","Follow the recovery steps below.")}
            <div class="kc-stack-list">
              ${r.map((d,b)=>P(`${b+1}. ${d.title}`,d.command,d.detail)).join("")}
            </div>
          </section>
        `:""}

      <div class="kc-two-column">
        <section class="kc-panel">
          ${x("Repo State","Current repo truth and routing for this session.")}
          <div class="kc-info-grid">
            ${R("Project type",e.projectType)}
            ${R("Execution mode",e.executionMode)}
            ${R("Active specialist",c)}
            ${R("Selected pack",e.mcpPacks.selectedPack.name??e.mcpPacks.selectedPack.id)}
            ${R("Next action",s||"No repo-scoped next command is recorded.")}
          </div>
        </section>
        <section class="kc-panel">
          ${x("Task Summary","The current working set and why it matters.")}
          <div class="kc-keyline-value">
            <strong>${h(m)}</strong>
            <span>${h((t.indexing.selectionReason??t.contextView.reason??t.nextActions.summary)||e.repoState.detail)}</span>
          </div>
          <div class="kc-stack-list">
            ${P("Current focus","repo-local",o)}
            ${P("Review pack",t.repoIntelligence.reviewPackAvailable?t.repoIntelligence.reviewPackPath??"ready":"not generated",t.repoIntelligence.reviewPackSummary??"Run kc review to write the compact local review workflow for the current diff.")}
          </div>
        </section>
      </div>

      <section class="kc-panel" data-render-section="explain-selection">
        ${x("Explain This Selection","Why the most important files are in the current working set.")}
        ${y.length>0?`<div class="kc-stack-list">${y.slice(0,6).map(d=>P(d.title,d.metric,d.note)).join("")}</div>`:A("No selected-file reasoning is available yet. Run kc prepare to build a bounded working set first.")}
      </section>

      ${os(e)}

      <section class="kc-panel">
        <div class="kc-panel-head-row">
          ${x("Context Tree","What Kiwi selected, considered, and ignored from the live selector state.")}
          ${W(((u=t.contextView.confidence)==null?void 0:u.toUpperCase())??"UNKNOWN",t.contextView.confidence==="high"?"success":t.contextView.confidence==="low"?"warn":"neutral")}
        </div>
        ${n.nodes.length>0?Zn(n):A('Run kc prepare "your task" to build a repo-local context tree.')}
      </section>
    </div>
  `}function Ui(e){var m;const t=e.kiwiControl??j,n=t.contextView,a=t.indexing,i=et(e),s=jn(e),o=i.nodes.slice(0,8),c=Xi(e);return`
    <div class="kc-view-shell">
      <section class="kc-view-header">
        <div>
          <p class="kc-view-kicker">Context Selection</p>
          <h1>${h(n.task??"No prepared task")}</h1>
          <p>${h(n.confidenceDetail??"Kiwi Control only shows files the selector actually considered.")}</p>
        </div>
        <div class="kc-header-metrics">
          ${Rt(String(n.tree.selectedCount),"selected")}
          ${Rt(String(n.tree.candidateCount),"candidate")}
          ${Rt(String(n.tree.excludedCount),"excluded")}
        </div>
      </section>

      <div class="kc-context-grid">
        <section class="kc-panel">
          <div class="kc-panel-head-row">
            ${x("Repo Tree","Selected, candidate, and excluded files grounded in live selector state.")}
            <div class="kc-inline-badges">
              <button class="kc-secondary-button" type="button" data-tree-bulk="include">Include visible</button>
              <button class="kc-secondary-button" type="button" data-tree-bulk="exclude">Exclude visible</button>
              <button class="kc-secondary-button" type="button" data-tree-bulk="reset">Reset local edits</button>
              <button class="kc-secondary-button" type="button" data-tree-bulk="undo">Undo</button>
              <button class="kc-secondary-button" type="button" data-reload-state>${F("refresh")}Refresh</button>
            </div>
          </div>
          <p class="kc-support-copy">Local include, exclude, and ignore edits stay in this desktop session until a CLI or runtime write commits them.</p>
          ${i.nodes.length>0?Zn(i):A('Run kc prepare "your task" to build the repo tree from live selection signals.')}
        </section>

        <section class="kc-panel">
          ${x("Navigation Map","Use this as a high-density orientation strip before drilling into the full tree.")}
          ${o.length>0?`<div class="kc-inline-badges">${o.map(p=>U(`${p.name}:${p.status}`)).join("")}</div>`:A("No top-level repo map is available yet.")}
          <div class="kc-divider"></div>
          ${x("Selection State",n.reason??"No selection reason recorded.")}
          <div class="kc-info-grid">
            ${R("Confidence",((m=n.confidence)==null?void 0:m.toUpperCase())??"UNKNOWN")}
            ${R("Scope area",a.scopeArea??"unknown")}
            ${R("Selected files",String(s.length))}
            ${R("Observed files",String(a.observedFiles))}
            ${R("Indexed files",String(a.indexedFiles))}
            ${R("Impact files",String(a.impactFiles))}
            ${R("Keyword matches",String(a.keywordSignals))}
            ${R("Import neighbors",String(a.importSignals))}
            ${R("Discovery depth",String(a.maxDepthExplored))}
          </div>
          <div class="kc-divider"></div>
          <div class="kc-stack-block">
            <p class="kc-stack-label">Coverage</p>
            <p class="kc-support-copy">${h(a.coverageNote)}</p>
            <div class="kc-inline-badges">
              ${U(`visited ${a.visitedDirectories} dirs`)}
              ${U(a.fileBudgetReached?"file budget hit":"file budget clear")}
              ${U(a.directoryBudgetReached?"dir budget hit":"dir budget clear")}
            </div>
          </div>
          <div class="kc-divider"></div>
          <div class="kc-stack-block">
            <p class="kc-stack-label">Selected files</p>
            ${s.length>0?Ye(s):A("No active files are selected yet.")}
          </div>
        </section>
      </div>

      <section class="kc-panel">
        ${x("How Kiwi Indexed This Repo","These are the actual scan and signal mechanics behind the current tree, not generic advice.")}
        <div class="kc-stack-list">
          ${c.map(p=>P(p.title,p.metric,p.note)).join("")}
        </div>
      </section>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${x("FILE ANALYSIS PANEL","Measured scan counts plus why files were selected, excluded, or skipped.")}
          <div class="kc-info-grid">
            ${R("Total files",String(t.fileAnalysis.totalFiles))}
            ${R("Scanned files",String(t.fileAnalysis.scannedFiles))}
            ${R("Skipped files",String(t.fileAnalysis.skippedFiles))}
            ${R("Selected files",String(t.fileAnalysis.selectedFiles))}
            ${R("Excluded files",String(t.fileAnalysis.excludedFiles))}
          </div>
          <div class="kc-divider"></div>
          <div class="kc-stack-list">
            ${t.fileAnalysis.selected.slice(0,3).map(p=>P(p.file,"selected",p.selectionWhy??p.reasons.join(", "))).join("")}
            ${t.fileAnalysis.excluded.slice(0,3).map(p=>P(p.file,"excluded",p.note??p.reasons.join(", "))).join("")}
            ${t.fileAnalysis.skipped.slice(0,3).map(p=>P(p.path,"skipped",p.reason)).join("")}
          </div>
        </section>
        <section class="kc-panel">
          ${x("CONTEXT TRACE","Initial signals, expansion steps, and final bounded selection.")}
          ${t.contextTrace.expansionSteps.length>0?`<div class="kc-fold-grid">${t.contextTrace.expansionSteps.map(p=>`
                <details class="kc-fold-card" open>
                  <summary>
                    <div>
                      <strong>${h(p.step)}</strong>
                      <span>${h(p.summary)}</span>
                    </div>
                    ${W(`${p.filesAdded.length} files`,"neutral")}
                  </summary>
                  <div class="kc-fold-body">
                    ${p.filesAdded.length>0?Ye(p.filesAdded.slice(0,8)):A("No files recorded for this step.")}
                    ${p.filesRemoved&&p.filesRemoved.length>0?`<div class="kc-divider"></div>${Ye(p.filesRemoved.slice(0,8))}`:""}
                  </div>
                </details>
              `).join("")}</div>`:A("Run kc prepare to record a trace of how Kiwi built the working set.")}
        </section>
      </div>

      <section class="kc-panel">
        ${x("Dependency Chains","Shortest structural paths that pulled files into the working set.")}
        ${t.fileAnalysis.selected.some(p=>Array.isArray(p.dependencyChain)&&p.dependencyChain.length>1)?`<div class="kc-stack-list">${t.fileAnalysis.selected.filter(p=>Array.isArray(p.dependencyChain)&&p.dependencyChain.length>1).slice(0,6).map(p=>P(p.file,"chain",(p.dependencyChain??[]).join(" -> "))).join("")}</div>`:A("No structural dependency chain was needed for the current selection.")}
      </section>

      <section class="kc-panel">
        ${x("INDEXING","How the repo scan progressed, where it stopped, and which ignore rules were applied.")}
        <div class="kc-info-grid">
          ${R("Directories visited",String(a.visitedDirectories))}
          ${R("Skipped directories",String(a.skippedDirectories))}
          ${R("Depth reached",String(a.maxDepthExplored))}
          ${R("Files discovered",String(a.discoveredFiles))}
          ${R("Files analyzed",String(a.analyzedFiles))}
          ${R("Index reused",String(a.indexReusedFiles))}
          ${R("Index refreshed",String(a.indexUpdatedFiles))}
          ${R("Ignore rules",String(a.ignoreRulesApplied.length))}
        </div>
        <div class="kc-divider"></div>
        <div class="kc-inline-badges">
          ${dt("heuristic",t.contextTrace.honesty.heuristic)}
          ${dt("low confidence",t.contextTrace.honesty.lowConfidence)}
          ${dt("partial scan",t.contextTrace.honesty.partialScan||a.partialScan)}
        </div>
        <div class="kc-divider"></div>
        <div class="kc-stack-list">
          ${a.ignoreRulesApplied.slice(0,4).map(p=>xe(p)).join("")}
        </div>
      </section>
    </div>
  `}function Gi(e){const t=Li(e),n=t.nodes.find(a=>a.path===(Le??((I==null?void 0:I.kind)==="path"?I.path:null)))??null;return fa({state:e,graph:t,focusedNode:n,graphDepth:oe,graphPan:be,graphZoom:ve,graphMechanics:Qi(e,t),treeMechanics:Zi(e),helpers:tt()})}function Ki(e){const t=e.validation.issues??[],n=t.filter(i=>i.level==="warn"),a=t.filter(i=>i.level==="error");return`
    <div class="kc-view-shell">
      <section class="kc-view-header">
        <div>
          <p class="kc-view-kicker">Validation</p>
          <h1>${h(e.repoState.title)}</h1>
          <p>${h(e.repoState.detail)}</p>
        </div>
        <button class="kc-secondary-button" type="button" data-reload-state>${F("refresh")}Reload state</button>
      </section>

      <div class="kc-stat-grid">
        ${L("Passing",e.validation.ok?"yes":"no","repo contract",e.validation.ok?"success":"warn")}
        ${L("Errors",String(e.validation.errors),"blocking",e.validation.errors>0?"critical":"neutral")}
        ${L("Warnings",String(e.validation.warnings),"non-blocking",e.validation.warnings>0?"warn":"neutral")}
        ${L("Memory",`${e.memoryBank.filter(i=>i.present).length}/${e.memoryBank.length}`,"surfaces present","neutral")}
      </div>

      <section class="kc-panel">
        <div class="kc-tab-row">
          ${Ae("all",_e,"All")}
          ${Ae("issues",_e,`Issues ${a.length+n.length>0?`(${a.length+n.length})`:""}`,"data-validation-tab")}
          ${Ae("pending",_e,"Pending","data-validation-tab")}
        </div>
        ${Wi(e)}
      </section>
    </div>
  `}function Wi(e){const n=(e.validation.issues??[]).filter(a=>a.level==="error"||a.level==="warn");return _e==="issues"?n.length>0?`<div class="kc-stack-list">${n.map(ps).join("")}</div>`:A("No warnings or errors are currently recorded in repo-local validation."):_e==="pending"?A("Kiwi Control does not infer pending checks beyond repo-local validation state."):`
    <div class="kc-two-column">
      <section class="kc-subpanel">
        ${x("Repo Contract",e.repoState.sourceOfTruthNote)}
        <div class="kc-info-grid">
          ${e.repoOverview.map(a=>R(a.label,a.value,a.tone==="warn"?"warn":"default")).join("")}
        </div>
      </section>
      <section class="kc-subpanel">
        ${x("Continuity","Latest checkpoint, handoff, reconcile, and open risk state.")}
        <div class="kc-info-grid">
          ${e.continuity.map(a=>R(a.label,a.value,a.tone==="warn"?"warn":"default")).join("")}
        </div>
      </section>
    </div>
  `}function qi(e){const t=e.kiwiControl??j,n=t.tokenAnalytics;return`
    <div class="kc-view-shell">
      <section class="kc-view-header">
        <div>
          <p class="kc-view-kicker">Token Analytics</p>
          <h1>${h(n.task??"No token estimate yet")}</h1>
          <p>${h(n.estimateNote??'Run kc prepare "your task" to generate a repo-local rough estimate.')}</p>
        </div>
        ${W(n.estimationMethod??"not generated","neutral")}
      </section>

      <div class="kc-stat-grid">
        ${L("Selected",`~${z(n.selectedTokens)}`,"approximate","neutral")}
        ${L("Full Repo",`~${z(n.fullRepoTokens)}`,"approximate","neutral")}
        ${L("Saved",`~${n.savingsPercent}%`,"approximate","success")}
        ${L("Measured Files",`${n.fileCountSelected}/${n.fileCountTotal}`,"direct count","neutral")}
        ${L("Measured Usage",t.measuredUsage.available?z(t.measuredUsage.totalTokens):"unavailable",t.measuredUsage.available?`${t.measuredUsage.totalRuns} real runs`:"falling back to estimate",t.measuredUsage.available?"success":"warn")}
      </div>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${x("Measured Usage",t.measuredUsage.note)}
          ${t.measuredUsage.available?`<div class="kc-stack-list">
                ${P("Source",t.measuredUsage.source,t.measuredUsage.note)}
                ${t.measuredUsage.workflows.slice(0,4).map(a=>P(a.workflow,`${z(a.tokens)} tokens`,`${a.runs} runs`)).join("")}
              </div>`:A("No measured repo usage was found in local session or execution logs.")}
        </section>
        <section class="kc-panel">
          ${x("Estimated Usage",n.estimationMethod??"No estimate method recorded.")}
          <div class="kc-stack-list">
            ${P("Selected working set",`~${z(n.selectedTokens)}`,"Heuristic estimate for the current bounded context.")}
            ${P("Full repo",`~${z(n.fullRepoTokens)}`,"Heuristic estimate for all scanned repo files.")}
            ${P("Savings",`~${n.savingsPercent}%`,"Measured file counts with heuristic token estimation.")}
          </div>
        </section>
      </div>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${x("Top Directories","Measured directories with the largest share of estimated token usage.")}
          ${n.topDirectories.length>0?`<div class="kc-bar-list">${n.topDirectories.slice(0,6).map(a=>us(a.directory,a.tokens,n.fullRepoTokens,`${a.fileCount} files`)).join("")}</div>`:A("No directory analytics recorded yet.")}
        </section>
        <section class="kc-panel">
          ${x("Context Breakdown",n.estimationMethod??"No estimate method recorded.")}
          ${bn("Selected vs repo",n.selectedTokens,n.fullRepoTokens)}
          ${t.wastedFiles.files.length>0?bn("Wasted within selection",t.wastedFiles.totalWastedTokens,n.selectedTokens):""}
          <div class="kc-divider"></div>
          ${t.wastedFiles.files.length>0?`<div class="kc-stack-list">${t.wastedFiles.files.slice(0,4).map(a=>P(a.file,`${z(a.tokens)} tokens`,a.reason)).join("")}</div>`:A("No wasted files are recorded in the active selection.")}
        </section>
      </div>

      <section class="kc-panel">
        ${x("How To Reduce Tokens","Concrete actions that affect selection size, measured usage, and model tradeoffs.")}
        <div class="kc-stack-list">
          ${Yi(e).map(a=>P(a.title,a.metric,a.note)).join("")}
        </div>
      </section>

      <section class="kc-panel">
        ${x("Why These Token Numbers Look This Way","Token analytics here are driven by the indexed tree, selected working set, and measured local execution data when available.")}
        <div class="kc-stack-list">
          ${es(e).map(a=>P(a.title,a.metric,a.note)).join("")}
        </div>
      </section>

      <section class="kc-panel">
        ${x("Heavy Directories","Directories that dominate repo token volume.")}
        ${t.heavyDirectories.directories.length>0?`<div class="kc-stack-list">${t.heavyDirectories.directories.slice(0,4).map(a=>P(a.directory,`${a.percentOfRepo}% of repo`,a.suggestion)).join("")}</div>`:A("No heavy-directory warnings are recorded for this repo.")}
      </section>

      <section class="kc-panel">
        ${x("TOKEN BREAKDOWN","Where token reduction came from, and whether that reduction is measured or heuristic.")}
        ${t.tokenBreakdown.categories.length>0?`<div class="kc-stack-list">${t.tokenBreakdown.categories.map(a=>P(a.category,`${a.basis} · ~${z(a.estimated_tokens_avoided)}`,a.note)).join("")}</div>`:A("No token breakdown has been recorded yet.")}
      </section>

      <section class="kc-panel">
        ${x("Measured Files","Per-file measured usage is only shown when repo-local execution entries carry non-zero token totals.")}
        ${t.measuredUsage.files.length>0?`<div class="kc-stack-list">${t.measuredUsage.files.slice(0,6).map(a=>P(a.file,`${z(a.tokens)} tokens`,`${a.runs} runs · ${a.attribution}`)).join("")}</div>`:A("No measured per-file attribution is available yet.")}
      </section>
    </div>
  `}function Ji(e){const t=e.mcpPacks.compatibleCapabilities,n=t.filter(o=>o.trustLevel==="high").length,a=t.filter(o=>o.writeCapable).length,i=t.filter(o=>o.approvalRequired).length,s=Ca({selectedPack:e.mcpPacks.selectedPack,selectedPackSource:e.mcpPacks.selectedPackSource,explicitSelection:e.mcpPacks.explicitSelection,available:e.mcpPacks.available});return`
    <div class="kc-view-shell">
      <section class="kc-view-header">
        <div>
          <p class="kc-view-kicker">MCP / Tool Integrations</p>
          <h1>${h(s.selectedPackCard.name)}</h1>
          <p>${h(`${s.selectedPackLabel}. ${s.selectedPackCard.description}`)}</p>
        </div>
        ${W(e.mcpPacks.capabilityStatus,e.mcpPacks.capabilityStatus==="compatible"?"success":"warn")}
      </section>

      <div class="kc-stat-grid">
        ${L("Compatible MCPs",String(t.length),s.selectedPackSourceLabel,t.length>0?"success":"warn")}
        ${L("High Trust",String(n),"preferred first",n>0?"success":"neutral")}
        ${L("Write Capable",String(a),"requires judgment",a>0?"warn":"neutral")}
        ${L("Approval Gates",String(i),"use with care",i>0?"warn":"neutral")}
      </div>

      <div class="kc-two-column">
        <section class="kc-panel" data-render-section="mcp-selected-pack">
          ${x("Selected Pack",e.mcpPacks.note)}
          <div class="kc-stack-list">
            ${P("Current state",s.selectedPackCard.stateLabel,s.selectedPackCard.sourceLabel??e.mcpPacks.note)}
            ${R("Source",s.selectedPackSourceLabel)}
            ${R("Heuristic default",e.mcpPacks.suggestedPack.name??e.mcpPacks.suggestedPack.id)}
            ${R("Executable",e.mcpPacks.executable?"yes":"no")}
          </div>
          ${e.mcpPacks.unavailablePackReason?`<div class="kc-divider"></div><div class="kc-stack-list">${P("Blocked","warn",e.mcpPacks.unavailablePackReason)}</div>`:""}
          <div class="kc-divider"></div>
          <div class="kc-stack-list">
            ${s.selectedPackCard.guidance.map(o=>xe(o)).join("")}
          </div>
          ${s.showClearAction?'<div class="kc-divider"></div><div class="kc-stack-list"><button class="kc-action-button secondary" data-pack-action="clear">Clear explicit pack</button></div>':""}
        </section>
        <section class="kc-panel">
          ${x("Compatible MCP Capabilities","These integrations are active for the selected pack, repo profile, and workflow role.")}
          ${t.length>0?`<div class="kc-stack-list">${t.map(o=>ds(o)).join("")}</div>`:A("No compatible MCP integrations are currently exposed for this workflow role and profile.")}
        </section>
      </div>

      <div class="kc-two-column">
        <section class="kc-panel" data-render-section="mcp-selectable-packs">
          ${x("Selectable Packs","Executable packs you can switch to in this repo.")}
          <div class="kc-fold-grid">
            ${s.executablePackCards.length>0?s.executablePackCards.map(o=>`
            <details class="kc-fold-card" data-pack-card="true" data-pack-id="${h(o.id)}">
              <summary>
                <div>
                  <strong>${h(o.name)}</strong>
                  <span>${h(o.description)}</span>
                </div>
                ${W(o.stateLabel,o.stateTone)}
              </summary>
              <div class="kc-fold-body">
                <div class="kc-stack-list">
                  ${o.guidance.map(c=>xe(c)).join("")}
                </div>
                <div class="kc-divider"></div>
                <div class="kc-stack-list">
                  ${R("Allowed",o.allowedCapabilityIds.join(", ")||"none")}
                  ${R("Preferred",o.preferredCapabilityIds.join(", ")||"none")}
                </div>
                <div class="kc-divider"></div>
                <div class="kc-stack-list">
                  <button class="kc-action-button" data-pack-action="set" data-pack-id="${h(o.id)}">Select pack</button>
                </div>
              </div>
            </details>
          `).join(""):A("No alternative executable packs are available in this repo.")}
          </div>
        </section>
        <section class="kc-panel" data-render-section="mcp-blocked-packs">
          ${x("Unavailable Here","Visible for clarity, but blocked until matching integrations are registered.")}
          ${s.blockedPackCards.length>0?`<div class="kc-stack-list">${s.blockedPackCards.map(o=>`
                <div class="kc-note-row kc-note-row-blocked">
                  <div>
                    <strong>${h(o.name)}</strong>
                    <span>${h(o.blockedReason??"This pack is not available in the current repo.")}</span>
                  </div>
                  <button class="kc-action-button secondary" data-pack-action="blocked" data-pack-id="${h(o.id)}" disabled>Unavailable</button>
                </div>
              `).join("")}</div>`:A("All visible packs are currently executable in this repo.")}
        </section>
      </div>
    </div>
  `}function Yi(e){var i;const t=e.kiwiControl??j,n=t.tokenAnalytics,a=[];if(Bn(t.contextView.task)?a.push({title:"Replace the placeholder task",metric:"task is too broad",note:"The current task label is generic, so Kiwi leans on repo-context and recent-file signals. Preparing with a real goal narrows the selected tree and usually lowers token estimates."}):n.estimationMethod?a.push({title:"Narrow the working set",metric:`${n.fileCountSelected}/${n.fileCountTotal} files`,note:"Use Include, Exclude, and Ignore in Context or Graph to shrink the selected tree before execution. Those tree changes are what alter the next token estimate."}):a.push({title:"Generate a bounded estimate",metric:"prepare first",note:"Run kc prepare with the actual task goal so Kiwi can record a selected working set before showing reduction guidance."}),a.push({title:"Tree drives token estimates",metric:`${t.contextView.tree.selectedCount} selected · ${t.contextView.tree.excludedCount} excluded`,note:"The graph is a projection of the tree. If a file stays selected in the tree, it still counts toward the working-set estimate."}),a.push({title:"Index reuse reduces rescanning",metric:`${t.indexing.indexReusedFiles} reused · ${t.indexing.indexUpdatedFiles} refreshed`,note:"Kiwi reuses index entries when it can and only refreshes changed or newly discovered files. The token estimate is still based on the current selected tree, not random guesses."}),t.wastedFiles.files.length>0&&a.push({title:"Remove wasted files",metric:`~${z(t.wastedFiles.totalWastedTokens)}`,note:`Exclude or ignore ${((i=t.wastedFiles.files[0])==null?void 0:i.file)??"low-value files"} to reduce token use without changing the task goal.`}),t.heavyDirectories.directories.length>0){const s=t.heavyDirectories.directories[0];s&&a.push({title:"Scope the heaviest directory",metric:`${s.percentOfRepo}%`,note:s.suggestion})}return a.push({title:"Understand the tradeoff",metric:n.savingsPercent>0?`~${n.savingsPercent}% saved`:"no savings yet",note:"Smaller context usually lowers tokens and speeds review, but it increases the risk of missing adjacent files or reverse dependents."}),t.measuredUsage.available||a.push({title:"Collect real usage",metric:"estimated only",note:"Measured token usage appears only after local guide, validate, or execution flows record real runs. Until then, the token view is an indexed working-set estimate."}),a}function Xi(e){const t=e.kiwiControl??j,n=t.indexing,a=t.contextTrace.initialSignals;return[{title:"Index coverage",metric:`${n.indexedFiles} indexed · ${n.indexUpdatedFiles} refreshed · ${n.indexReusedFiles} reused`,note:n.coverageNote},{title:"Selection signals",metric:`${n.changedSignals} changed · ${n.importSignals} import · ${n.keywordSignals} keyword · ${n.repoContextSignals} repo`,note:"These are the signal buckets Kiwi used to pull files into the working set."},{title:"Observed tree",metric:`${t.contextView.tree.selectedCount} selected · ${t.contextView.tree.candidateCount} candidate · ${t.contextView.tree.excludedCount} excluded`,note:"The repo tree is built from the current context-selection artifact. Selected files are in-scope, candidate files were considered, and excluded files were filtered out."},{title:"Initial evidence",metric:`${a.changedFiles.length} changed · ${a.importNeighbors.length} import neighbors · ${a.keywordMatches.length} keyword matches`,note:"Before Kiwi expands scope, it starts from changed files, import neighbors, keyword matches, recent files, and repo-context files."}]}function Qi(e,t){var a;const n=((a=e.kiwiControl)==null?void 0:a.indexing)??j.indexing;return[{title:"Source of truth",metric:"context tree",note:"This graph is drawn from the current selected/candidate/excluded tree. It is not a full semantic code graph or call graph."},{title:"Visible projection",metric:`${t.nodes.length} nodes · ${t.edges.length} links`,note:`Depth ${oe} controls how much of the current tree projection is visible from the repo root.`},{title:"Highlight behavior",metric:"dependency chain when available",note:"When Kiwi has a structural dependency chain for a file, it highlights that path. Otherwise it falls back to the ancestor path in the tree."},{title:"Indexed evidence behind the map",metric:`${n.changedSignals} changed · ${n.importSignals} import · ${n.keywordSignals} keyword`,note:"Those index signals decide which files appear in the working set before the graph turns them into a visual map."}]}function Zi(e){var n;const t=((n=e.kiwiControl)==null?void 0:n.contextView.tree)??j.contextView.tree;return[{title:"Selected",metric:String(t.selectedCount),note:"Selected files are the current bounded working set. They drive validation expectations and token estimates."},{title:"Candidate",metric:String(t.candidateCount),note:"Candidate files were considered relevant enough to surface, but are not currently in the selected working set."},{title:"Excluded",metric:String(t.excludedCount),note:"Excluded files were filtered by the selector. Local Include/Exclude/Ignore UI edits are session-local until a real CLI command rewrites repo state."}]}function es(e){const t=e.kiwiControl??j,n=t.tokenAnalytics;return[{title:"Estimate basis",metric:n.estimationMethod??"heuristic only",note:n.estimateNote??"Kiwi is using the indexed working set to estimate token volume."},{title:"Tree to token path",metric:`${t.contextView.tree.selectedCount} selected files`,note:"The selected tree is the direct input to the working-set token estimate. Excluding a file from the tree is what reduces the next estimate."},{title:"Measured vs estimated",metric:t.measuredUsage.available?`${z(t.measuredUsage.totalTokens)} measured`:"estimate only",note:t.measuredUsage.available?t.measuredUsage.note:"No local execution runs have recorded measured usage yet, so the token numbers are derived from the current indexed tree."},{title:"Index churn",metric:`${t.indexing.indexReusedFiles} reused · ${t.indexing.indexUpdatedFiles} refreshed`,note:"Kiwi does not blindly rescan everything every time. It reuses indexed entries when possible, then recomputes token estimates from the current selected tree."}]}function ts(e){var a;const t=e.specialists.activeProfile,n=e.specialists.recommendedProfile;return`
    <div class="kc-view-shell">
      <section class="kc-view-header">
        <div>
          <p class="kc-view-kicker">Specialists</p>
          <h1>${h((t==null?void 0:t.name)??e.specialists.activeSpecialist)}</h1>
          <p>${h((t==null?void 0:t.purpose)??"Specialist routing is derived from repo-local role hints, task type, and file area.")}</p>
        </div>
        ${W((t==null?void 0:t.riskPosture)??"active",(t==null?void 0:t.riskPosture)==="conservative"?"success":"neutral")}
      </section>

      <div class="kc-stat-grid">
        ${L("Active",(t==null?void 0:t.name)??e.specialists.activeSpecialist,"current role fit","neutral")}
        ${L("Recommended",(n==null?void 0:n.name)??e.specialists.recommendedSpecialist,"best next handoff","success")}
        ${L("Targets",String(e.specialists.handoffTargets.length),"handoff candidates","neutral")}
        ${L("Preferred Tools",String(((a=t==null?void 0:t.preferredTools)==null?void 0:a.length)??0),"active specialist","neutral")}
      </div>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${x("Active Specialist","The role currently shaping the workspace and compatible capability set.")}
          ${t?vn(t):A("No active specialist is currently recorded.")}
        </section>
        <section class="kc-panel">
          ${x("Routing Safety",e.specialists.safeParallelHint)}
          <div class="kc-stack-list">
            ${P("Current role",e.specialists.activeSpecialist,(t==null?void 0:t.purpose)??"No active specialist profile is available.")}
            ${P("Recommended next",e.specialists.recommendedSpecialist,(n==null?void 0:n.purpose)??"No recommended specialist profile is available.")}
            ${P("Handoff targets",`${e.specialists.handoffTargets.length}`,e.specialists.safeParallelHint)}
          </div>
        </section>
      </div>

      <section class="kc-panel">
        ${x("Specialist Catalog","Available specialists for the current profile, including their role and risk posture.")}
        <div class="kc-fold-grid">
          ${(e.specialists.available??[]).map(i=>`
            <details class="kc-fold-card" ${i.specialistId===e.specialists.activeSpecialist?"open":""}>
              <summary>
                <div>
                  <strong>${h(i.name??i.specialistId)}</strong>
                  <span>${h(i.purpose??"No purpose recorded.")}</span>
                </div>
                ${W(i.riskPosture??"neutral",i.specialistId===e.specialists.activeSpecialist?"success":"neutral")}
              </summary>
              <div class="kc-fold-body">
                ${vn(i)}
              </div>
            </details>
          `).join("")}
        </div>
      </section>
    </div>
  `}function ns(e){var y;const t=e.kiwiControl??j,n=Math.max(0,t.execution.totalExecutions-Math.round(t.execution.successRate/100*t.execution.totalExecutions)),a=ms(e),i=t.workflow.steps.filter(r=>r.status==="success").length,s=t.workflow.steps.find(r=>r.status==="failed")??null,o=it(e,"execution-plan"),c=it(e,"workflow"),m=it(e,"runtime-lifecycle"),p=it(e,"decision-logic");return`
    <div class="kc-view-shell">
      <section class="kc-view-header">
        <div>
          <p class="kc-view-kicker">System State</p>
          <h1>System visibility</h1>
          <p>Execution health, indexing coverage, adaptive learning, and repo-control operating signals.</p>
        </div>
        ${W(t.execution.tokenTrend,t.execution.tokenTrend==="improving"?"success":t.execution.tokenTrend==="worsening"?"warn":"neutral")}
      </section>

      <div class="kc-stat-grid">
        ${L("Executions",String(t.execution.totalExecutions),"tracked runs","neutral")}
        ${L("Failures",String(n),"recorded scope or completion failures",n>0?"warn":"success")}
        ${L("Success Rate",`${t.execution.successRate}%`,"real completion history",t.execution.successRate>=80?"success":"warn")}
        ${L("Feedback Strength",t.feedback.adaptationLevel,`${t.feedback.totalRuns} successful runs`,t.feedback.adaptationLevel==="active"?"success":"neutral")}
        ${L("Lifecycle",e.executionState.lifecycle,e.executionState.reason??e.readiness.detail,e.executionState.lifecycle==="blocked"||e.executionState.lifecycle==="failed"?"warn":"neutral")}
        ${L("Workflow",t.workflow.status,t.workflow.currentStepId??"no current step",t.workflow.status==="failed"?"warn":"neutral")}
      </div>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${x("Indexing & Structure",t.indexing.coverageNote)}
          <div class="kc-info-grid">
            ${R("Observed files",String(t.indexing.observedFiles))}
            ${R("Discovered files",String(t.indexing.discoveredFiles))}
            ${R("Indexed files",String(t.indexing.indexedFiles))}
            ${R("Impact files",String(t.indexing.impactFiles))}
            ${R("Visited directories",String(t.indexing.visitedDirectories))}
            ${R("Max depth",String(t.indexing.maxDepthExplored))}
            ${R("Changed signals",String(t.indexing.changedSignals))}
            ${R("Repo-context signals",String(t.indexing.repoContextSignals))}
          </div>
          <div class="kc-divider"></div>
          <div class="kc-inline-badges">
            ${U(t.indexing.fileBudgetReached?"file budget limited":"file budget clear")}
            ${U(t.indexing.directoryBudgetReached?"dir budget limited":"dir budget clear")}
            ${U(`scope: ${t.indexing.scopeArea??"unknown"}`)}
          </div>
        </section>
        <section class="kc-panel">
          ${x("Execution Health","Real runtime accounting from repo-local execution history.")}
          ${a.length>0?`<div class="kc-timeline">${a.slice(0,5).map(r=>`
                <article class="kc-timeline-item">
                  <div class="kc-timeline-marker ${r.tone}">
                    ${r.icon}
                  </div>
                  <div class="kc-timeline-copy">
                    <div class="kc-timeline-head">
                      <strong>${h(r.title)}</strong>
                      <span>${h(r.timestamp)}</span>
                    </div>
                    <p>${h(r.detail)}</p>
                  </div>
                </article>
              `).join("")}</div>`:A("No execution history has been recorded yet.")}
        </section>
      </div>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${x("Task Lifecycle",`A runtime-derived lifecycle snapshot from prepare to packet generation, checkpoint, and handoff. ${m}`)}
          <div class="kc-stack-list">
            ${P("Current stage",e.executionState.lifecycle,e.executionState.reason??e.readiness.detail)}
            ${P("Validation",t.runtimeLifecycle.validationStatus??"unknown",t.runtimeLifecycle.nextSuggestedCommand??"No suggested command is recorded yet.")}
            ${P("Task",t.runtimeLifecycle.currentTask??"none recorded",((y=t.runtimeLifecycle.recentEvents[0])==null?void 0:y.summary)??"No lifecycle events are recorded yet.")}
          </div>
        </section>
        <section class="kc-panel">
          ${x("Waste & Weight","Files and directories that inflate scope without helping the task.")}
          ${t.wastedFiles.files.length>0?`<div class="kc-stack-list">${t.wastedFiles.files.slice(0,4).map(r=>P(r.file,`${z(r.tokens)} tokens`,r.reason)).join("")}</div>`:A("No wasted files are recorded in the current selection.")}
        </section>
        <section class="kc-panel">
          ${x("Heavy Directories","Areas that dominate estimated token volume and deserve tighter scoping.")}
          ${t.heavyDirectories.directories.length>0?`<div class="kc-stack-list">${t.heavyDirectories.directories.slice(0,4).map(r=>P(r.directory,`${r.percentOfRepo}%`,r.suggestion)).join("")}</div>`:A("No heavy-directory signal is recorded for this repo yet.")}
        </section>
      </div>

      <section class="kc-panel">
        ${x("Next Commands",`Exact CLI commands from the runtime-derived execution plan. ${o}`)}
        ${t.executionPlan.nextCommands.length>0?Ye(t.executionPlan.nextCommands):A("No next commands are currently recorded.")}
      </section>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${x("Workflow Steps",`Runtime-derived workflow snapshot for the active task. ${c}`)}
          <div class="kc-inline-badges">
            ${U(`${i}/${t.workflow.steps.length} successful`)}
            ${U(s?`failed: ${s.action}`:"no failed step")}
          </div>
          ${s!=null&&s.failureReason?`<div class="kc-divider"></div>${P("Failure reason",s.action,s.failureReason)}`:""}
          ${t.workflow.steps.length>0?`<div class="kc-stack-list">${t.workflow.steps.map(r=>P(`${r.action}`,`${r.status}${r.retryCount>0?` · retry ${r.retryCount}`:""}${r.attemptCount>0?` · attempt ${r.attemptCount}`:""}`,r.failureReason??r.result.summary??r.validation??r.expectedOutput??r.result.suggestedFix??r.tokenUsage.note)).join("")}</div>`:A("No workflow state has been recorded yet.")}
        </section>
        <section class="kc-panel">
          ${x("Execution Trace","What executed, which files were used, which skills applied, and token usage per step.")}
          ${t.executionTrace.steps.length>0?`<div class="kc-stack-list">${t.executionTrace.steps.map(r=>P(r.action,r.tokenUsage.source==="none"?`${r.status}${r.retryCount>0?` · retry ${r.retryCount}`:""}`:`${r.status}${r.retryCount>0?` · retry ${r.retryCount}`:""} · ${r.tokenUsage.measuredTokens!=null?z(r.tokenUsage.measuredTokens):`~${z(r.tokenUsage.estimatedTokens??0)}`}`,r.failureReason?`${r.failureReason}${r.files.length>0?` | files: ${r.files.slice(0,3).join(", ")}`:""}`:`${r.result.summary??(r.files.slice(0,3).join(", ")||"no files")}${r.skillsApplied.length>0?` | skills: ${r.skillsApplied.join(", ")}`:""}${r.result.validation?` | validation: ${r.result.validation}`:r.expectedOutput?` | expects: ${r.expectedOutput}`:""}${r.result.retryCommand?` | retry: ${r.result.retryCommand}`:""}`)).join("")}</div>`:A("No execution trace is available yet.")}
        </section>
      </div>

      <section class="kc-panel">
        ${x("DECISION LOGIC",`Runtime-derived decision snapshot showing which signals won and which signals were intentionally ignored. ${p}`)}
        <div class="kc-two-column">
          <section class="kc-subpanel">
            ${x("Reasoning chain",t.decisionLogic.summary||"No decision summary recorded.")}
            ${t.decisionLogic.reasoningChain.length>0?`<div class="kc-stack-list">${t.decisionLogic.reasoningChain.map(r=>xe(r)).join("")}</div>`:A("No reasoning chain is available yet.")}
          </section>
          <section class="kc-subpanel">
            ${x("Ignored signals","Signals Kiwi saw but did not let dominate the next action.")}
            ${t.decisionLogic.ignoredSignals.length>0?`<div class="kc-stack-list">${t.decisionLogic.ignoredSignals.map(r=>xe(r)).join("")}</div>`:A("No ignored signals are currently recorded.")}
          </section>
        </div>
      </section>

      <section class="kc-panel">
        ${x("Runtime Events",`Hook-style events emitted by Kiwi’s lightweight runtime integration. ${m}`)}
        ${t.runtimeLifecycle.recentEvents.length>0?`<div class="kc-stack-list">${t.runtimeLifecycle.recentEvents.slice(0,6).map(r=>P(`${r.type} · ${r.stage}`,r.status,r.summary)).join("")}</div>`:A("No runtime events are recorded yet.")}
      </section>

      <section class="kc-panel">
        ${x("Ecosystem Discovery","Read-only external capability metadata used to inform decisions without executing tools directly.")}
        <div class="kc-two-column">
          <section class="kc-subpanel">
            ${x("Known tools","Selected tools and ecosystems from Awesome Copilot and Awesome Claude Code.")}
            <div class="kc-stack-list">
              ${e.ecosystem.tools.slice(0,5).map(r=>P(r.name,r.category,r.description)).join("")}
            </div>
          </section>
          <section class="kc-subpanel">
            ${x("Known workflows","Advisory workflow patterns only.")}
            <div class="kc-stack-list">
              ${e.ecosystem.workflows.slice(0,4).map(r=>P(r.name,r.source,r.description)).join("")}
            </div>
          </section>
        </div>
      </section>
    </div>
  `}function as(e){return Ma({state:e,activeMode:ee,helpers:tt()})}function it(e,t){const n=e.derivedFreshness.find(a=>a.outputName===t);return n?`Compatibility/debug snapshot${n.sourceRevision!=null?` · revision ${n.sourceRevision}`:""}${n.generatedAt?` · generated ${n.generatedAt}`:""}.`:"Compatibility/debug snapshot."}function is(e){const n=(e.kiwiControl??j).feedback,a=n.totalRuns>0||n.topBoostedFiles.length>0||n.topPenalizedFiles.length>0||n.recentEntries.length>0||n.basedOnPastRuns,i=n.topBoostedFiles.slice(0,4),s=n.topPenalizedFiles.slice(0,4),o=n.recentEntries.slice(0,6),c=[];return i.length>0&&c.push(`
      <section class="kc-panel">
        ${x("Boosted Files","Files that helped successful runs in this task scope.")}
        <div class="kc-stack-list">${i.map(m=>kn(m.file,m.score,"success")).join("")}</div>
      </section>
    `),s.length>0&&c.push(`
      <section class="kc-panel">
        ${x("Penalized Files","Files Kiwi is learning to avoid for this task scope.")}
        <div class="kc-stack-list">${s.map(m=>kn(m.file,m.score,"warn")).join("")}</div>
      </section>
    `),n.basedOnPastRuns&&c.push(`
      <section class="kc-panel">
        ${x("Retrieval Reuse","Only shown when Kiwi is confidently reusing a past pattern.")}
        <div class="kc-stack-list">
          ${P("Reused pattern",n.reusedPattern??"similar work",n.note)}
          ${n.similarTasks.slice(0,4).map(m=>P(m.task,`similarity ${m.similarity}`,le(m.timestamp))).join("")}
        </div>
      </section>
    `),`
    <div class="kc-view-shell">
      <section class="kc-view-header">
        <div>
          <p class="kc-view-kicker">Feedback</p>
          <h1>${h(n.adaptationLevel==="active"?"Adaptive feedback is active":"Adaptive feedback is limited")}</h1>
          <p>${h(n.note)}</p>
        </div>
        ${W(`${n.totalRuns} runs`,n.adaptationLevel==="active"?"success":"neutral")}
      </section>

      ${a?`
      <div class="kc-stat-grid">
        ${L("Valid Runs",String(n.totalRuns),"successful completions","neutral")}
        ${L("Success Rate",`${n.successRate}%`,"repo-local",n.successRate>=80?"success":"neutral")}
        ${L("Learned Files",String(n.topBoostedFiles.length+n.topPenalizedFiles.length),"boosted and penalized",n.topBoostedFiles.length>0?"success":n.topPenalizedFiles.length>0?"warn":"neutral")}
        ${L("Reuse",n.basedOnPastRuns?"active":"idle",n.basedOnPastRuns?"pattern reuse engaged":"fresh selection first",n.basedOnPastRuns?"success":"neutral")}
      </div>

      <section class="kc-panel">
        ${x("Recent Completions","Only valid successful completions train future selection behavior.")}
        ${o.length>0?`<div class="kc-stack-list">${o.map(m=>`
              <div class="kc-note-row">
                <div>
                  <strong>${h(m.task)}</strong>
                  <span>${h(`${m.filesUsed}/${m.filesSelected} files used · ${le(m.timestamp)}`)}</span>
                </div>
                ${W(m.success?"success":"fail",m.success?"success":"warn")}
              </div>
            `).join("")}</div>`:A("No recent feedback events are available yet.")}
      </section>

      ${c.length>0?`<div class="kc-two-column">${c.join("")}</div>`:""}
      `:`
          <section class="kc-panel">
            ${x("Adaptive Feedback","Kiwi keeps this quiet until successful runtime-backed work creates useful signal.")}
            <div class="kc-stack-list">
              ${P("Current state",n.adaptationLevel,n.note)}
              ${P("What to do next","keep working normally","Use the main runtime-backed flow first. This page grows only when there is real signal to show.")}
            </div>
          </section>
        `}
    </div>
  `}function ss(e){e.kiwiControl;const t=I,n=t?Dt.get(t.id)??"unmarked":"unmarked";return ba({...Aa({state:e,focusedItem:t,marker:n,activeMode:ee,commandState:k,resolveFocusedStep:a=>(a==null?void 0:a.kind)==="step"?Qe(e).find(i=>i.id===a.id)??null:null,resolveFocusedNode:a=>(a==null?void 0:a.kind)==="path"?Vn(e,a.path):null}),helpers:{...tt(),renderGateRow:Qn,renderBulletRow:xe}})}function os(e){var n;const t=Qe(e);return va({...{state:e,steps:t,editingPlanStepId:Oe,editingPlanDraft:we,focusedItem:I,commandState:k,failureGuidance:ca(((n=e.kiwiControl)==null?void 0:n.executionPlan.lastError)??null)},helpers:{escapeHtml:h,escapeAttribute:Jt,formatCliCommand:Ne,renderPanelHeader:x,renderInlineBadge:U,renderNoteRow:P,renderEmptyState:A,renderHeaderBadge:W}})}function rs(e){const t=gs(e),n=hs(e),a=n.length>0?n.map(i=>`
        <div class="kc-log-line ${i.tone}">
          <span>${h(i.label)}</span>
          <strong>${h(i.value)}</strong>
        </div>
      `).join(""):fs(e);return`
    <div class="kc-log-shell">
      <div class="kc-log-header">
        ${ee==="inspection"?`<div class="kc-tab-row">
              ${Ae("history",he,"Execution History","data-log-tab")}
              ${Ae("validation",he,"Validation Output","data-log-tab")}
              ${Ae("logs",he,"System Logs","data-log-tab")}
            </div>`:`<div class="kc-tab-row">${Ae("history","history","Execution History")}</div>`}
        <button class="kc-icon-button" type="button" data-toggle-logs>
          ${F("close")}
        </button>
      </div>
      <div class="kc-log-body">
        ${ee==="execution"?a:he==="validation"?cs(e.validation):he==="history"?a:t.length>0?t.map(i=>`
                <div class="kc-log-line">
                  <span>${h(i.label)}</span>
                  <strong>${h(i.value)}</strong>
                </div>
              `).join(""):A("No repo activity is recorded yet.")}
      </div>
    </div>
  `}function cs(e){const t=e.issues??[];return t.length===0?'<div class="kc-log-line"><span>info</span><strong>Repo validation is currently passing.</strong></div>':t.map(n=>`
    <div class="kc-log-line ${n.level==="error"?"is-error":n.level==="warn"?"is-warn":""}">
      <span>${h(n.level)}</span>
      <strong>${h(`${n.filePath?`${n.filePath}: `:""}${n.message}`)}</strong>
    </div>
  `).join("")}function L(e,t,n,a){return`
    <article class="kc-stat-card tone-${a}">
      <span>${h(e)}</span>
      <strong>${h(t)}</strong>
      <em>${h(n)}</em>
    </article>
  `}function Rt(e,t){return`
    <div class="kc-small-metric">
      <strong>${h(e)}</strong>
      <span>${h(t)}</span>
    </div>
  `}function x(e,t){return`
    <header class="kc-panel-header">
      <div>
        <p>${h(e)}</p>
        <h3>${h(e)}</h3>
      </div>
      <span>${h(t)}</span>
    </header>
  `}function R(e,t,n="default"){return`
    <div class="kc-info-row">
      <span>${h(e)}</span>
      <strong class="${n==="warn"?"is-warn":""}">${h(t)}</strong>
    </div>
  `}function ls(e){const t=e.toLowerCase();return t.includes("low confidence")?"May miss relevant files or choose the wrong working set.":t.includes("partial scan")?"Repo understanding may be incomplete until context expands.":t.includes("changed files")?"Recent edits can dominate the plan and change the safest next step.":t.includes("reverse depend")?"Downstream breakage can be missed if structural dependents are ignored.":t.includes("keyword")?"Task matching may drift away from the user’s actual request.":t.includes("repo context")?"Repo-local authority and critical files may be skipped.":"Ignoring this signal can reduce decision quality or hide relevant files."}function W(e,t){return`<span class="kc-badge badge-${h(t==="bridge-unavailable"||t==="low"?"warn":t==="medium"?"neutral":t==="high"?"success":t)}">${h(e)}</span>`}function Qn(e,t,n){return`
    <div class="kc-info-row kc-gate-row">
      <span>${h(e)}</span>
      <strong class="${n==="warn"?"is-warn":n==="success"?"is-success":""}">${h(t)}</strong>
    </div>
  `}function Ae(e,t,n,a="data-validation-tab"){return`<button class="kc-tab-button ${e===t?"is-active":""}" type="button" ${a}="${h(e)}">${h(n)}</button>`}function Ye(e){return`<div class="kc-inline-badges">${e.map(t=>`<span class="kc-inline-badge">${h(t)}</span>`).join("")}</div>`}function U(e){return`<span class="kc-inline-badge">${h(e)}</span>`}function dt(e,t){return`<span class="kc-inline-badge ${t?"is-active":"is-muted"}">${h(e)}</span>`}function xe(e){return`
    <div class="kc-bullet-row">
      <span class="kc-bullet-dot"></span>
      <span>${h(e)}</span>
    </div>
  `}function ds(e){return`
    <article class="kc-capability-card">
      <div class="kc-capability-head">
        <div>
          <strong>${h(e.id)}</strong>
          <span>${h(e.category)}</span>
        </div>
        ${W(e.trustLevel,e.trustLevel==="high"?"success":e.trustLevel==="low"?"warn":"neutral")}
      </div>
      <p>${h(e.purpose)}</p>
      <div class="kc-inline-badges">
        ${U(e.readOnly?"read only":"read write")}
        ${U(e.writeCapable?"write capable":"no writes")}
        ${U(e.approvalRequired?"approval required":"self-serve")}
      </div>
      ${e.usageGuidance.length>0?`<div class="kc-capability-notes">${e.usageGuidance.slice(0,2).map(xe).join("")}</div>`:""}
    </article>
  `}function vn(e){return`
    <div class="kc-stack-list">
      <div class="kc-note-row">
        <div>
          <strong>${h(e.name??e.specialistId)}</strong>
          <span>${h(e.purpose??"No purpose recorded.")}</span>
        </div>
        <em>${h(e.riskPosture??"unknown")}</em>
      </div>
      <div class="kc-inline-badges">
        ${U(`id: ${e.specialistId}`)}
        ${U(`tools: ${(e.preferredTools??[]).join(", ")||"none"}`)}
        ${U(`aliases: ${(e.aliases??[]).join(", ")||"none"}`)}
      </div>
    </div>
  `}function kn(e,t,n){return`
    <div class="kc-score-row">
      <span>${h(e)}</span>
      <strong class="tone-${n}">${t>0?`+${t}`:`${t}`}</strong>
    </div>
  `}function us(e,t,n,a){const i=n>0?Math.max(6,Math.round(t/n*100)):6;return`
    <div class="kc-bar-row">
      <div class="kc-bar-copy">
        <strong>${h(e)}</strong>
        <span>${h(`${z(t)} · ${a}`)}</span>
      </div>
      <div class="kc-bar-track"><div class="kc-bar-fill" style="width: ${i}%"></div></div>
    </div>
  `}function P(e,t,n){return`
    <div class="kc-note-row">
      <div>
        <strong>${h(e)}</strong>
        <span>${h(n)}</span>
      </div>
      <em>${h(t)}</em>
    </div>
  `}function bn(e,t,n){if(n<=0)return"";const a=Math.max(0,Math.min(100,Math.round(t/n*100)));return`
    <div class="kc-meter-row">
      <div class="kc-meter-copy">
        <span>${h(e)}</span>
        <strong>${a}%</strong>
      </div>
      <div class="kc-meter-track"><div class="kc-meter-fill" style="width: ${a}%"></div></div>
    </div>
  `}function ps(e){return`
    <article class="kc-issue-card issue-${h(e.level)}">
      <div>
        <strong>${h(e.filePath??"repo contract")}</strong>
        <span>${h(e.message)}</span>
      </div>
      ${W(e.level,e.level==="error"?"critical":"warn")}
    </article>
  `}function A(e){return`<p class="kc-empty-state">${h(e)}</p>`}function Zn(e){return ga({tree:e,focusedItem:I,contextOverrides:pe,helpers:{escapeHtml:h,escapeAttribute:Jt,renderEmptyState:A}})}function ms(e){const t=e.kiwiControl??j,n=[];for(const o of t.execution.recentExecutions)n.push({title:o.success?"Execution completed":"Execution failed",detail:`${o.task} · ${o.filesTouched} files touched`,timestamp:le(o.timestamp),tone:o.success?"tone-success":"tone-warn",icon:o.success?F("check"):F("alert"),...o.tokensUsed>0?{meta:[`~${z(o.tokensUsed)} tokens`]}:{}});for(const o of t.runtimeLifecycle.recentEvents.slice(0,4))n.push({title:`Runtime ${o.type}`,detail:o.summary,timestamp:le(o.timestamp),tone:o.status==="error"?"tone-warn":o.status==="warn"?"tone-neutral":"tone-success",icon:o.status==="error"?F("alert"):o.status==="warn"?F("system"):F("check"),...o.files.length>0?{meta:o.files.slice(0,3)}:{}});const a=$e(e.continuity,"Latest checkpoint");a!=="none recorded"&&n.push({title:"Checkpoint updated",detail:a,timestamp:"repo-local",tone:"tone-neutral",icon:F("checkpoint")});const i=$e(e.continuity,"Latest handoff");i!=="none recorded"&&n.push({title:"Handoff available",detail:i,timestamp:"repo-local",tone:"tone-neutral",icon:F("handoffs")});const s=$e(e.continuity,"Latest reconcile");return s!=="none recorded"&&n.push({title:"Reconcile state updated",detail:s,timestamp:"repo-local",tone:"tone-neutral",icon:F("activity")}),n.slice(0,8)}function yn(e){return e.replace(/[-_]+/g," ").replace(/\b\w/g,t=>t.toUpperCase())}function hs(e){const t=e.kiwiControl??j;return t.executionEvents.recentEvents.length>0?t.executionEvents.recentEvents.slice(0,10).map(n=>{const a=n.reason??n.sourceCommand??n.task??n.nextCommand??"No runtime detail recorded.",i=Object.keys(n.artifacts).length>0?"artifacts updated":null;return{label:yn(n.eventType),value:`${a}${i?` · ${i}`:""} · ${le(n.recordedAt)}`,tone:n.lifecycle==="failed"?"is-error":n.lifecycle==="blocked"?"is-warn":""}}):t.runtimeLifecycle.recentEvents.length>0?t.runtimeLifecycle.recentEvents.slice(0,8).map(n=>({label:yn(n.type),value:`${n.summary} · ${le(n.timestamp)}`,tone:n.status==="error"?"is-error":n.status==="warn"?"is-warn":""})):t.execution.recentExecutions.slice(0,8).map(n=>({label:n.success?"Run":"Failed run",value:`${n.task} · ${n.filesTouched} files · ~${z(n.tokensUsed)} tokens · ${le(n.timestamp)}`,tone:n.success?"":"is-warn"}))}function fs(e){const t=(e.kiwiControl??j).executionEvents.source;return A(t==="runtime"?"Runtime execution events are available for this repo, but no recent entries are recorded yet.":t==="compatibility"?"The repo-local compatibility event log is empty right now. Runtime event history is not currently available.":"Runtime execution event history is unavailable for this repo right now.")}function gs(e){return[...(e.kiwiControl??j).execution.recentExecutions.map(a=>({label:a.success?"run":"run failed",value:`${a.task} · ${a.filesTouched} files · ${le(a.timestamp)}`})),...e.continuity.slice(0,3).map(a=>({label:a.label,value:a.value}))].slice(0,8)}function ea(e,t){return`<span class="kc-icon-label">${e}<em>${h(t)}</em></span>`}function F(e){const t='viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';switch(e){case"overview":return`<svg ${t}><rect x="3" y="4" width="7" height="7"/><rect x="14" y="4" width="7" height="7"/><rect x="3" y="13" width="7" height="7"/><rect x="14" y="13" width="7" height="7"/></svg>`;case"context":return`<svg ${t}><path d="M4 19V5h16v14Z"/><path d="M8 9h8"/><path d="M8 13h5"/></svg>`;case"graph":return`<svg ${t}><circle cx="12" cy="12" r="2"/><circle cx="6" cy="7" r="2"/><circle cx="18" cy="7" r="2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/><path d="M10.5 10.5 7.5 8.5"/><path d="m13.5 10.5 3-2"/><path d="m10.8 13.4-2.5 3"/><path d="m13.2 13.4 2.5 3"/></svg>`;case"validation":return`<svg ${t}><path d="M12 3 4 7v6c0 4.5 3.2 6.9 8 8 4.8-1.1 8-3.5 8-8V7Z"/><path d="m9 12 2 2 4-4"/></svg>`;case"activity":return`<svg ${t}><path d="M3 12h4l2-4 4 8 2-4h6"/></svg>`;case"tokens":return`<svg ${t}><circle cx="12" cy="12" r="8"/><path d="M9 12h6"/><path d="M12 9v6"/></svg>`;case"handoffs":return`<svg ${t}><path d="m7 7 5-4 5 4"/><path d="M12 3v14"/><path d="m17 17-5 4-5-4"/></svg>`;case"feedback":return`<svg ${t}><path d="M12 3v6"/><path d="m15 12 6-3"/><path d="m9 12-6-3"/><path d="m15 15 4 4"/><path d="m9 15-4 4"/><circle cx="12" cy="12" r="3"/></svg>`;case"mcps":return`<svg ${t}><path d="M4 12h16"/><path d="M12 4v16"/><path d="m6.5 6.5 11 11"/><path d="m17.5 6.5-11 11"/></svg>`;case"specialists":return`<svg ${t}><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/></svg>`;case"system":return`<svg ${t}><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 4v16"/><path d="M15 4v16"/><path d="M4 9h16"/><path d="M4 15h16"/></svg>`;case"logs-open":return`<svg ${t}><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h10"/><path d="m19 15-3 3 3 3"/></svg>`;case"logs-closed":return`<svg ${t}><path d="M4 6h16"/><path d="M4 12h10"/><path d="M4 18h16"/><path d="m15 9 3 3-3 3"/></svg>`;case"panel-open":return`<svg ${t}><rect x="3" y="4" width="18" height="16"/><path d="M15 4v16"/></svg>`;case"panel-closed":return`<svg ${t}><rect x="3" y="4" width="18" height="16"/><path d="M9 4v16"/></svg>`;case"close":return`<svg ${t}><path d="m6 6 12 12"/><path d="m18 6-12 12"/></svg>`;case"refresh":return`<svg ${t}><path d="M20 11a8 8 0 0 0-14.9-3"/><path d="M4 4v5h5"/><path d="M4 13a8 8 0 0 0 14.9 3"/><path d="M20 20v-5h-5"/></svg>`;case"check":return`<svg ${t}><path d="m5 12 4 4 10-10"/></svg>`;case"alert":return`<svg ${t}><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/></svg>`;case"checkpoint":return`<svg ${t}><path d="M6 4h12v6H6z"/><path d="M9 10v10"/><path d="M15 10v10"/></svg>`;case"sun":return`<svg ${t}><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`;case"moon":return`<svg ${t}><path d="M12 3a6 6 0 1 0 9 9A9 9 0 1 1 12 3Z"/></svg>`;default:return`<svg ${t}><circle cx="12" cy="12" r="8"/></svg>`}}function z(e){const t=Math.abs(e),n=[{value:1e12,suffix:"T"},{value:1e9,suffix:"B"},{value:1e6,suffix:"M"},{value:1e3,suffix:"K"}];for(const a of n)if(t>=a.value)return`${(e/a.value).toFixed(1).replace(/\.0$/,"")}${a.suffix}`;return ta(e)}function ta(e){return e.toLocaleString("en-US")}function vs(e){return e==null?"n/a":`${e.toFixed(1)}%`}function ks(e){return e==null?"—":`$${e.toFixed(2)}`}function le(e){if(!e)return"unknown time";const t=new Date(e);return Number.isNaN(t.getTime())?e:t.toLocaleString(void 0,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})}function $e(e,t){var n;return((n=e.find(a=>a.label===t))==null?void 0:n.value)??"none recorded"}function Gt(e){if(!e)return"No repo loaded";const t=e.split(/[\\/]/).filter(Boolean);return t[t.length-1]??e}function Kt(e){return Ua(e,S)}function kt(e,t){return Ga(e,t,Ut(e))}async function na(){if(!O())return null;try{return await G("consume_initial_launch_request")}catch{return null}}async function aa(e,t=!1){return O()?await G("load_repo_control_state",{targetRoot:e,preferSnapshot:t}):qt(e)}async function Wt(e,t){if(!(!O()||!e))try{await G("set_active_repo_target",{targetRoot:e,revision:t})}catch{}}function qt(e){const t=e.trim().length>0,n=t?e:"";return{targetRoot:n,loadState:{source:"bridge-fallback",freshness:"failed",generatedAt:new Date().toISOString(),snapshotSavedAt:null,snapshotAgeMs:null,detail:t?"Repo-local state could not be loaded from the Kiwi bridge.":"No repo is loaded yet."},profileName:"default",executionMode:"local",projectType:"unknown",repoState:{mode:"bridge-unavailable",title:t?"Could not load this repo yet":"Open a repo",detail:t?"Kiwi Control could not read repo-local state for this folder yet.":"Run kc ui inside a repo to load it automatically.",sourceOfTruthNote:"Repo-local artifacts under .agent/ and promoted repo instruction files remain the source of truth. The desktop app never replaces that state."},executionState:{revision:0,operationId:null,task:null,sourceCommand:null,lifecycle:"failed",reason:t?"Kiwi Control could not read repo-local execution state for this folder yet.":"No repo is loaded yet.",nextCommand:t?"kc ui":"kc init",blockedBy:t?["Repo-local execution state is unavailable."]:[],lastUpdatedAt:null},readiness:{label:t?"Desktop bridge unavailable":"Open a repo",tone:"failed",detail:t?"Kiwi Control could not read repo-local execution state for this folder yet.":"Run kc ui inside a repo to load it automatically.",nextCommand:t?"kc ui":"kc init"},runtimeIdentity:null,derivedFreshness:[],runtimeDecision:{currentStepId:"idle",currentStepLabel:"Idle",currentStepStatus:"failed",nextCommand:t?"kc ui":"kc init",readinessLabel:t?"Desktop bridge unavailable":"Open a repo",readinessTone:"failed",readinessDetail:t?"Kiwi Control could not read repo-local execution state for this folder yet.":"Run kc ui inside a repo to load it automatically.",nextAction:{action:t?"Restore the desktop bridge":"Open a repo",command:t?"kc ui":"kc init",reason:t?"Kiwi Control could not read repo-local execution state for this folder yet.":"Run kc ui inside a repo to load it automatically.",priority:"critical"},recovery:{kind:"failed",reason:t?"Kiwi Control could not read repo-local execution state for this folder yet.":"Run kc ui inside a repo to load it automatically.",fixCommand:t?"kc ui":"kc init",retryCommand:t?"kc ui":"kc init"},decisionSource:"bridge-fallback",updatedAt:new Date().toISOString()},repoOverview:[{label:"Project type",value:t?"unknown (awaiting repo bridge)":"no repo loaded",...t?{tone:"warn"}:{}},{label:"Active role",value:"none recorded"},{label:"Next file",value:t?".agent/project.yaml":"run kc ui inside a repo"},{label:"Next command",value:t?"kc ui":"kc init"},{label:"Validation state",value:t?"bridge unavailable":"waiting for repo",...t?{tone:"warn"}:{}},{label:"Current phase",value:t?"restore repo bridge":"load a repo"}],continuity:[{label:"Latest checkpoint",value:"none recorded"},{label:"Latest handoff",value:"none recorded"},{label:"Latest reconcile",value:"none recorded"},{label:"Current focus",value:t?`reload repo-local state for ${n}`:"open a repo from the CLI"},{label:"Open risks",value:t?"Cannot read repo-local state yet.":"No repo loaded.",tone:"warn"}],memoryBank:[],specialists:{activeSpecialist:"review-specialist",recommendedSpecialist:"review-specialist",activeProfile:null,recommendedProfile:null,handoffTargets:[],safeParallelHint:"Restore repo-local visibility first."},mcpPacks:{selectedPack:{id:"core-pack",description:"Default repo-first pack."},selectedPackSource:"heuristic-default",explicitSelection:null,suggestedPack:{id:"core-pack",description:"Default repo-first pack.",guidance:[],realismNotes:[]},available:[],compatibleCapabilities:[],effectiveCapabilityIds:[],preferredCapabilityIds:[],executable:!1,unavailablePackReason:"Pack selection is unavailable until repo-local state can be loaded.",capabilityStatus:"limited",note:"No compatible MCP integrations are available until repo-local state can be loaded."},validation:{ok:!1,errors:t?1:0,warnings:t?0:1,issues:[]},ecosystem:{artifactType:"kiwi-control/ecosystem-catalog",version:1,timestamp:new Date().toISOString(),tools:[],workflows:[],capabilities:[],notes:["Ecosystem metadata becomes available once repo-local state loads."]},machineAdvisory:{artifactType:"kiwi-control/machine-advisory",version:3,generatedBy:"kiwi-control machine-advisory",windowDays:7,updatedAt:"",stale:!0,sections:{inventory:{status:"partial",updatedAt:"",reason:"Machine-local advisory is unavailable."},mcpInventory:{status:"partial",updatedAt:"",reason:"Machine-local advisory is unavailable."},optimizationLayers:{status:"partial",updatedAt:"",reason:"Machine-local advisory is unavailable."},setupPhases:{status:"partial",updatedAt:"",reason:"Machine-local advisory is unavailable."},configHealth:{status:"partial",updatedAt:"",reason:"Machine-local advisory is unavailable."},usage:{status:"partial",updatedAt:"",reason:"Machine-local advisory is unavailable."},guidance:{status:"partial",updatedAt:"",reason:"Machine-local advisory is unavailable."}},inventory:[],mcpInventory:{claudeTotal:0,codexTotal:0,copilotTotal:0,tokenServers:[]},optimizationLayers:[],setupPhases:[],configHealth:[],skillsCount:0,copilotPlugins:[],usage:{days:7,claude:{available:!1,days:[],totals:{inputTokens:0,outputTokens:0,cacheCreationTokens:0,cacheReadTokens:0,totalTokens:0,totalCost:null,cacheHitRatio:null},note:"Machine-local advisory is unavailable."},codex:{available:!1,days:[],totals:{inputTokens:0,outputTokens:0,cachedInputTokens:0,reasoningOutputTokens:0,sessions:0,totalTokens:0,cacheHitRatio:null},note:"Machine-local advisory is unavailable."},copilot:{available:!1,note:"Machine-local advisory is unavailable."}},optimizationScore:{planning:{label:"planning",score:0,earnedPoints:0,maxPoints:100,activeSignals:[],missingSignals:[]},execution:{label:"execution",score:0,earnedPoints:0,maxPoints:100,activeSignals:[],missingSignals:[]},assistant:{label:"assistant",score:0,earnedPoints:0,maxPoints:100,activeSignals:[],missingSignals:[]}},setupSummary:{installedTools:{readyCount:0,totalCount:0},healthyConfigs:{readyCount:0,totalCount:0},activeTokenLayers:[],readyRuntimes:{planning:!1,execution:!1,assistant:!1}},systemHealth:{criticalCount:0,warningCount:0,okCount:0},guidance:[],note:"Machine-local advisory is unavailable."},kiwiControl:j}}function h(e){return e.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;")}function Jt(e){return h(e)}function O(){return typeof window<"u"&&"__TAURI_INTERNALS__"in window}
