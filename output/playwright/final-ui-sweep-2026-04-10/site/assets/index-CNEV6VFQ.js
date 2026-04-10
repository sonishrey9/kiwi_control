(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))a(i);new MutationObserver(i=>{for(const s of i)if(s.type==="childList")for(const r of s.addedNodes)r.tagName==="LINK"&&r.rel==="modulepreload"&&a(r)}).observe(document,{childList:!0,subtree:!0});function n(i){const s={};return i.integrity&&(s.integrity=i.integrity),i.referrerPolicy&&(s.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?s.credentials="include":i.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function a(i){if(i.ep)return;i.ep=!0;const s=n(i);fetch(i.href,s)}})();function oa(e,t){var n,a,i,s,r,c,u,d;return t.lastRepoLoadFailure&&da(e.loadState.source)?{tone:"degraded",title:e.loadState.source==="stale-snapshot"?"Using older snapshot":"Using cached snapshot",detail:`Kiwi kept the last usable snapshot because fresh repo-local state failed to load. It is safe for inspection, but not trusted for workflow execution: ${t.lastRepoLoadFailure}`,nextCommand:null,actionLabel:"Reload state"}:e.repoState.mode==="bridge-unavailable"||e.loadState.source==="bridge-fallback"?{tone:"failed",title:"Desktop bridge unavailable",detail:t.lastRepoLoadFailure??"Kiwi could not load repo-local state into the desktop shell.",nextCommand:null,actionLabel:"Reload state"}:e.repoState.mode==="repo-not-initialized"?{tone:"blocked",title:"Repo not initialized",detail:"Kiwi opened the repo, but the repo-local continuity files are not set up yet.",nextCommand:"kc init"}:e.repoState.mode==="initialized-invalid"||e.validation.errors>0||(a=(n=e.kiwiControl)==null?void 0:n.executionPlan)!=null&&a.blocked?{tone:"blocked",title:e.readiness.label,detail:((s=(i=e.runtimeDecision)==null?void 0:i.recovery)==null?void 0:s.reason)??e.readiness.detail,nextCommand:Jt(e)}:e.executionState.lifecycle==="blocked"||e.executionState.lifecycle==="failed"?{tone:((c=(r=e.runtimeDecision)==null?void 0:r.recovery)==null?void 0:c.kind)==="failed"||e.executionState.lifecycle==="failed"?"failed":"blocked",title:e.readiness.label,detail:((d=(u=e.runtimeDecision)==null?void 0:u.recovery)==null?void 0:d.reason)??e.readiness.detail,nextCommand:Jt(e)}:null}function ra(e,t,n){return e==="checkpoint"?{tone:"blocked",title:"Checkpoint unavailable",detail:t,nextCommand:n}:e==="handoff"?{tone:"blocked",title:"Handoff unavailable",detail:t,nextCommand:n}:{tone:"blocked",title:"Run Auto needs a real goal",detail:t,nextCommand:n}}function ca(e){return e?{tone:"blocked",title:"Why it stopped",detail:e.reason,nextCommand:e.fixCommand,followUpCommand:e.retryCommand}:null}function la(e){return{title:"Kiwi Control failed to start",intro:"The renderer hit an error before it could mount the UI.",steps:["Relaunch Kiwi Control once to confirm the failure is repeatable.","Run `kc ui` from Terminal to check whether the desktop bridge starts cleanly there.","If it still fails, capture the error details below before reporting it."],detail:e}}function Jt(e){var t,n,a,i,s,r,c,u,d,y,o,$;return((n=(t=e.runtimeDecision)==null?void 0:t.recovery)==null?void 0:n.fixCommand)??((a=e.runtimeDecision)==null?void 0:a.nextCommand)??e.executionState.nextCommand??e.readiness.nextCommand??((r=(s=(i=e.kiwiControl)==null?void 0:i.executionPlan)==null?void 0:s.lastError)==null?void 0:r.fixCommand)??((d=(u=(c=e.kiwiControl)==null?void 0:c.executionPlan)==null?void 0:u.lastError)==null?void 0:d.retryCommand)??(($=(o=(y=e.kiwiControl)==null?void 0:y.executionPlan)==null?void 0:o.nextCommands)==null?void 0:$[0])??`kiwi-control validate --target "${e.targetRoot}"`}function da(e){return e==="warm-snapshot"||e==="stale-snapshot"}function Lt(){return document.querySelector("#boot-overlay")}function Sn(e,t){const n=Lt();n&&(n.classList.remove("is-hidden"),n.innerHTML=`
    <div class="kc-boot-fallback">
      <div class="kc-boot-card">
        <h1>${Fe(e)}</h1>
        <p>${Fe(t)}</p>
      </div>
    </div>
  `)}function mt(e){const t=Lt();if(!t)return;const n=la(e);t.classList.remove("is-hidden"),t.innerHTML=`
    <div class="kc-boot-fallback">
      <div class="kc-boot-card">
        <h1>${Fe(n.title)}</h1>
        <p>${Fe(n.intro)}</p>
        <ol>
          ${n.steps.map(a=>`<li>${Fe(a)}</li>`).join("")}
        </ol>
        <pre>${Fe(n.detail)}</pre>
      </div>
    </div>
  `}function ua(){var e;(e=Lt())==null||e.classList.add("is-hidden")}function Fe(e){return e.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;")}window.__KIWI_BOOT_API__={mounted:!1,renderMessage:Sn,renderError:mt,hide:ua};Sn("Loading Kiwi Control","External boot diagnostics loaded. If this message never changes, the main renderer bundle is failing before mount.");window.addEventListener("error",e=>{var t;(t=window.__KIWI_BOOT_API__)!=null&&t.mounted||mt(e.message||"Unknown startup error")});window.addEventListener("unhandledrejection",e=>{var n;if((n=window.__KIWI_BOOT_API__)!=null&&n.mounted)return;const t=e.reason;mt(typeof t=="string"?t:(t==null?void 0:t.message)??"Unhandled promise rejection")});window.setTimeout(()=>{var e;(e=window.__KIWI_BOOT_API__)!=null&&e.mounted||mt("Renderer timeout: the main UI bundle did not report a successful mount.")},3e3);function pa(e,t=!1){return window.__TAURI_INTERNALS__.transformCallback(e,t)}async function U(e,t={},n){return window.__TAURI_INTERNALS__.invoke(e,t,n)}var Xt;(function(e){e.WINDOW_RESIZED="tauri://resize",e.WINDOW_MOVED="tauri://move",e.WINDOW_CLOSE_REQUESTED="tauri://close-requested",e.WINDOW_DESTROYED="tauri://destroyed",e.WINDOW_FOCUS="tauri://focus",e.WINDOW_BLUR="tauri://blur",e.WINDOW_SCALE_FACTOR_CHANGED="tauri://scale-change",e.WINDOW_THEME_CHANGED="tauri://theme-changed",e.WINDOW_CREATED="tauri://window-created",e.WEBVIEW_CREATED="tauri://webview-created",e.DRAG_ENTER="tauri://drag-enter",e.DRAG_OVER="tauri://drag-over",e.DRAG_DROP="tauri://drag-drop",e.DRAG_LEAVE="tauri://drag-leave"})(Xt||(Xt={}));async function ha(e,t){window.__TAURI_EVENT_PLUGIN_INTERNALS__.unregisterListener(e,t),await U("plugin:event|unlisten",{event:e,eventId:t})}async function Qt(e,t,n){var a;const i=(a=void 0)!==null&&a!==void 0?a:{kind:"Any"};return U("plugin:event|listen",{event:e,target:i,handler:pa(t)}).then(s=>async()=>ha(e,s))}function ma(e){const{state:t,decision:n,repoLabel:a,phase:i,validationState:s,themeLabel:r,activeTheme:c,activeMode:u,isLogDrawerOpen:d,isInspectorOpen:y,currentTargetRoot:o,commandState:$,currentTask:b,retryEnabled:p,composerConstraint:m,runtimeInfo:f,loadStatus:I,helpers:N}=e,{escapeHtml:l,escapeAttribute:x,iconSvg:E,formatCliCommand:Y,renderHeaderBadge:K,renderHeaderMeta:W}=N,H=!o||$.loading;return`
    <div class="kc-topbar-primary">
      <div class="kc-topbar-left">
        <button class="kc-repo-pill" type="button">
          <span class="kc-repo-name">${l(a)}</span>
          <span class="kc-repo-path">${l(t.targetRoot||"No repo loaded yet")}</span>
        </button>
        ${K(t.repoState.title,t.repoState.mode)}
        ${K(t.projectType,"neutral")}
        ${i!=="none recorded"?K(i,"neutral"):""}
      </div>
      <div class="kc-topbar-center">
        ${W("Next",n.nextAction)}
        ${W("Blocking",n.blockingIssue)}
        ${W("Health",n.systemHealth)}
        ${W("Safe",n.executionSafety)}
        ${W("Changed",n.lastChangedAt)}
        ${W("Failures",String(n.recentFailures))}
        ${W("Warnings",String(n.newWarnings))}
        ${f?W(f.label,f.detail):""}
      </div>
      <div class="kc-topbar-right">
        <div class="kc-inline-badges">
          <button class="kc-tab-button ${u==="execution"?"is-active":""}" type="button" data-ui-mode="execution">Execution</button>
          <button class="kc-tab-button ${u==="inspection"?"is-active":""}" type="button" data-ui-mode="inspection">Inspection</button>
        </div>
        <div class="kc-status-chip">
          <strong>${l(u)}</strong>
          <span>${l(s)}</span>
        </div>
        <button class="kc-theme-toggle" type="button" data-theme-toggle>
          ${E(c==="dark"?"sun":"moon")}
          <span>${l(r)}</span>
        </button>
        <button class="kc-icon-button" type="button" data-toggle-logs>
          ${E(d?"logs-open":"logs-closed")}
        </button>
        <button class="kc-icon-button" type="button" data-toggle-inspector>
          ${E(y?"panel-open":"panel-closed")}
        </button>
      </div>
    </div>
    <div class="kc-topbar-actions">
      <div class="kc-topbar-action-group">
        <button class="kc-secondary-button kc-action-button" type="button" data-ui-command="guide" ${H?"disabled":""}>Guide</button>
        <button class="kc-secondary-button kc-action-button" type="button" data-ui-command="next" ${H?"disabled":""}>Next</button>
        <button class="kc-secondary-button kc-action-button" type="button" data-ui-command="review" ${H?"disabled":""}>Review</button>
        <button class="kc-secondary-button kc-action-button" type="button" data-ui-command="validate" ${H?"disabled":""}>Validate</button>
        <button class="kc-secondary-button kc-action-button" type="button" data-ui-command="retry" ${!p||H?"disabled":""}>Retry</button>
        <button class="kc-secondary-button kc-action-button" type="button" data-ui-command="run-auto" ${H||!b?"disabled":""}>Run Auto</button>
        <button class="kc-secondary-button kc-action-button" type="button" data-ui-command="checkpoint" ${H?"disabled":""}>Checkpoint</button>
        <button class="kc-secondary-button kc-action-button" type="button" data-ui-command="handoff" ${H||t.specialists.handoffTargets.length===0?"disabled":""}>Handoff</button>
      </div>
      ${$.composer?`
          <div class="kc-action-composer">
            <span class="kc-section-micro">${l($.composer)}</span>
            ${$.composer==="handoff"?`<select class="kc-action-input" data-command-draft>
                  ${[...new Set([$.draftValue,...t.specialists.handoffTargets].filter(Boolean))].map(je=>`
                    <option value="${x(je)}" ${je===$.draftValue?"selected":""}>${l(je)}</option>
                  `).join("")}
                </select>`:`<input class="kc-action-input" data-command-draft value="${x($.draftValue)}" placeholder="${x($.composer==="checkpoint"?"checkpoint label":"run description")}" />`}
            <button class="kc-secondary-button kc-action-button is-primary" type="button" data-composer-submit="${$.composer}" ${$.loading||m!=null&&m.blocked?"disabled":""}>Run</button>
            <button class="kc-secondary-button kc-action-button" type="button" data-composer-cancel ${$.loading?"disabled":""}>Cancel</button>
          </div>
          ${m?`<div class="kc-action-hint ${m.blocked?"is-blocked":""}">
                <strong>${l(m.reason)}</strong>
                ${m.nextCommand?`<code class="kc-command-chip">${l(Y(m.nextCommand,o))}</code>`:""}
              </div>`:""}
        `:""}
    </div>
    ${I.visible?`
        <div class="kc-load-strip tone-${I.tone}">
          <div class="kc-load-row">
            <span class="kc-load-badge">
              <span class="kc-load-dot"></span>
              ${l(I.label)}
            </span>
            <strong>${l(I.detail)}</strong>
          </div>
          ${I.nextCommand?`<div class="kc-action-hint is-blocked"><code class="kc-command-chip">${l(Y(I.nextCommand,o))}</code></div>`:""}
          <div class="kc-load-progress">
            <span class="kc-load-progress-fill" style="width:${I.progress}%"></span>
          </div>
        </div>
      `:""}
  `}function fa(e){const{state:t,graph:n,focusedNode:a,graphDepth:i,graphPan:s,graphZoom:r,graphMechanics:c,treeMechanics:u,helpers:d}=e,{escapeHtml:y,escapeAttribute:o,renderHeaderBadge:$,renderPanelHeader:b,renderNoteRow:p,renderEmptyState:m}=d;return`
    <div class="kc-view-shell">
      <section class="kc-view-header">
        <div>
          <p class="kc-view-kicker">Repo Graph</p>
          <h1>Context Graph</h1>
          <p>Repo topology from Kiwi’s current context tree. Click a node to inspect it, then use Focus, Include, Exclude, or Ignore.</p>
        </div>
        ${$(n.nodes.length>0?`${n.nodes.length} nodes`:"empty",n.nodes.length>0?"success":"warn")}
      </section>

      <section class="kc-panel">
        <div class="kc-panel-head-row">
          ${b("Graph Overview","Root-centered map of directories and files Kiwi currently knows about.")}
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
                <g class="kc-graph-viewport" data-graph-viewport transform="translate(${s.x} ${s.y}) scale(${r})">
                ${n.edges.map(f=>`
                  <line
                    x1="${f.from.x}"
                    y1="${f.from.y}"
                    x2="${f.to.x}"
                    y2="${f.to.y}"
                    data-graph-edge
                    data-from-path="${o(f.fromPath)}"
                    data-to-path="${o(f.toPath)}"
                    class="kc-graph-edge ${f.highlighted?"is-highlighted":""}"
                  />
                `).join("")}
                ${n.nodes.map(f=>`
                  <g
                    transform="translate(${f.x}, ${f.y})"
                    class="kc-graph-node-wrap ${f.highlighted?"is-highlighted":""}"
                    data-graph-node-wrap
                    data-path="${o(f.path)}"
                  >
                    <circle
                      r="${f.radius}"
                      data-graph-node
                      data-path="${o(f.path)}"
                      data-kind="${f.kind}"
                      class="kc-graph-node ${f.tone} importance-${f.importance}"
                    />
                    <text class="kc-graph-label" text-anchor="middle" dy=".35em">${y(f.label)}</text>
                  </g>
                `).join("")}
                </g>
              </svg>
            </div>
          `:m("No graph data is available yet. Run kiwi-control prepare to build a richer context tree.")}
      </section>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${b("Cluster Summary","Top visible nodes from the current context selection tree.")}
          ${n.summary.length>0?`<div class="kc-stack-list">${n.summary.map(f=>p(f.label,f.kind,f.meta)).join("")}</div>`:m("No cluster summary is available yet.")}
        </section>
        <section class="kc-panel">
          ${b("Node Actions",a?`${a.label} · ${a.kind}`:"Click a node in the map to act on it.")}
          ${a?`
              <div class="kc-stack-list">
                ${p("Status",a.status,`importance: ${a.importance}`)}
                ${p("Path",a.kind,a.path)}
                ${p("Project",t.projectType,t.repoState.detail)}
              </div>
              <div class="kc-divider"></div>
              <div class="kc-inline-badges">
                <button class="kc-secondary-button" type="button" data-graph-action="focus" data-path="${o(a.path)}">Focus</button>
                <button class="kc-secondary-button" type="button" data-graph-action="include" data-path="${o(a.path)}">Include</button>
                <button class="kc-secondary-button" type="button" data-graph-action="exclude" data-path="${o(a.path)}">Exclude</button>
                <button class="kc-secondary-button" type="button" data-graph-action="ignore" data-path="${o(a.path)}">Ignore</button>
                ${a.kind==="file"?`<button class="kc-secondary-button" type="button" data-graph-action="open" data-path="${o(a.path)}">Open</button>`:""}
              </div>
            `:m("No graph node is selected yet. Click a node in the map to focus it here.")}
        </section>
      </div>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${b("How This Map Is Built","This graph is projected from Kiwi’s current context tree and index signals, not from a full semantic dependency graph.")}
          ${c.length>0?`<div class="kc-stack-list">${c.map(f=>p(f.title,f.metric,f.note)).join("")}</div>`:m("No graph mechanics are available yet.")}
        </section>
        <section class="kc-panel">
          ${b("How Tree Status Works","Selected, candidate, and excluded statuses come from the current tree plus any local UI overrides.")}
          ${u.length>0?`<div class="kc-stack-list">${u.map(f=>p(f.title,f.metric,f.note)).join("")}</div>`:m("No tree mechanics are available yet.")}
        </section>
      </div>
    </div>
  `}function ga(e){const{tree:t,focusedItem:n,contextOverrides:a,helpers:i}=e,{escapeHtml:s,escapeAttribute:r}=i;return`
    <div class="kc-tree-shell">
      <div class="kc-tree-legend">
        <span><strong>✓</strong> selected</span>
        <span><strong>•</strong> candidate</span>
        <span><strong>×</strong> excluded</span>
      </div>
      <div class="kc-tree-root">
        ${t.nodes.map(c=>Cn(c,n,a,i)).join("")}
      </div>
    </div>
  `}function Cn(e,t,n,a){const{escapeHtml:i,escapeAttribute:s}=a,r=n.get(e.path),c=r?`override: ${r}`:e.status,u=(t==null?void 0:t.kind)==="path"&&t.path===e.path?"is-focused":"";return e.kind==="file"?`
      <div class="kc-tree-node tree-${i(e.status)} ${u}">
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
    <details class="kc-tree-node tree-dir tree-${i(e.status)} ${u}" ${e.expanded?"open":""}>
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
        ${e.children.map(d=>Cn(d,t,n,a)).join("")}
      </div>
    </details>
  `}function Zt(e){switch(e){case"selected":return"✓";case"excluded":return"×";default:return"•"}}function ka(e){var l,x;const{state:t,steps:n,editingPlanStepId:a,editingPlanDraft:i,focusedItem:s,commandState:r,failureGuidance:c,helpers:u}=e,{escapeHtml:d,escapeAttribute:y,formatCliCommand:o,renderPanelHeader:$,renderInlineBadge:b,renderNoteRow:p,renderEmptyState:m,renderHeaderBadge:f}=u,I=(l=t.kiwiControl)==null?void 0:l.executionPlan,N=t.derivedFreshness.find(E=>E.outputName==="execution-plan");return I?`
    <section class="kc-panel">
      ${$("Execution Plan",`${I.summary||"No execution plan is recorded yet."} Compatibility/debug snapshot${(N==null?void 0:N.sourceRevision)!=null?` · revision ${N.sourceRevision}`:""}${N!=null&&N.generatedAt?` · generated ${N.generatedAt}`:""}.`)}
      <div class="kc-inline-badges">
        ${b(`state: ${I.state}`)}
        ${b(`current: ${((x=n[I.currentStepIndex])==null?void 0:x.id)??"none"}`)}
        ${b(`risk: ${I.risk}`)}
        ${I.confidence?b(`confidence: ${I.confidence}`):""}
      </div>
      ${c?`<div class="kc-divider"></div><div class="kc-stack-list">
            ${p("Why it stopped",c.title,c.detail)}
            ${p("Do this now",c.nextCommand?o(c.nextCommand,t.targetRoot):"No fix command recorded","Run this before continuing.")}
            ${p("Then retry",c.followUpCommand?o(c.followUpCommand,t.targetRoot):"No retry command recorded","Use this after the blocking issue is cleared.")}
          </div>`:""}
      ${n.length>0?`<div class="kc-plan-list">${n.map((E,Y)=>va(E,Y,a,i,s,r.loading,{escapeHtml:d,escapeAttribute:y,renderHeaderBadge:f})).join("")}</div>`:m("No execution plan is available yet.")}
    </section>
  `:`
      <section class="kc-panel">
        ${$("Execution Plan","No execution plan is recorded yet.")}
        ${m("No execution plan is available yet.")}
      </section>
    `}function va(e,t,n,a,i,s,r){const{escapeHtml:c,escapeAttribute:u,renderHeaderBadge:d}=r,y=n===e.id,o=(i==null?void 0:i.kind)==="step"&&i.id===e.id;return`
    <article class="kc-plan-step ${e.skipped?"is-skipped":""} ${o?"is-focused":""}" data-step-row="${u(e.id)}">
      <div class="kc-plan-step-head">
        <div>
          <span class="kc-section-micro">step ${t+1}</span>
          ${y?`<input class="kc-action-input kc-plan-edit-input" data-plan-edit-input value="${u(a)}" />`:`<strong>${c(e.displayTitle)}</strong>`}
          <p>${c(e.displayNote??e.command)}</p>
        </div>
        <div class="kc-inline-badges">
          ${d(e.status,e.status==="failed"?"warn":e.status==="success"?"success":"neutral")}
          ${e.skipped?'<span class="kc-inline-badge">skipped</span>':""}
        </div>
      </div>
      <div class="kc-plan-step-actions">
        <button class="kc-secondary-button" type="button" data-plan-action="focus" data-step-id="${u(e.id)}">Focus</button>
        <button class="kc-secondary-button" type="button" data-plan-action="run" data-step-id="${u(e.id)}" ${s?"disabled":""}>Run</button>
        <button class="kc-secondary-button" type="button" data-plan-action="retry" data-step-id="${u(e.id)}" ${s?"disabled":""}>Retry</button>
        <button class="kc-secondary-button" type="button" data-plan-action="skip" data-step-id="${u(e.id)}">${e.skipped?"Unskip":"Skip"}</button>
        ${y?`
            <button class="kc-secondary-button" type="button" data-plan-action="edit-save" data-step-id="${u(e.id)}">Save</button>
            <button class="kc-secondary-button" type="button" data-plan-action="edit-cancel" data-step-id="${u(e.id)}">Cancel</button>
          `:`<button class="kc-secondary-button" type="button" data-plan-action="edit" data-step-id="${u(e.id)}">Edit</button>`}
        <button class="kc-secondary-button" type="button" data-plan-action="move-up" data-step-id="${u(e.id)}">↑</button>
        <button class="kc-secondary-button" type="button" data-plan-action="move-down" data-step-id="${u(e.id)}">↓</button>
      </div>
      <div class="kc-plan-step-meta">
        <code class="kc-command-chip">${c(e.command)}</code>
        <span>${c(e.validation)}</span>
        ${e.retryCommand?`<span>${c(e.retryCommand)}</span>`:""}
      </div>
    </article>
  `}function ba(e){var Y,K,W;const{state:t,primaryAction:n,activeSpecialist:a,topCapability:i,signalItems:s,focusedItem:r,focusedLabel:c,focusedReason:u,marker:d,activeMode:y,commandState:o,helpers:$}=e,{escapeHtml:b,renderInlineBadge:p,renderExplainabilityBadge:m,renderGateRow:f,renderBulletRow:I,renderNoteRow:N,deriveSignalImpact:l}=$,x=t.kiwiControl,E=t.derivedFreshness.find(H=>H.outputName==="runtime-lifecycle");return x?`
    <div class="kc-inspector-shell">
      <div class="kc-inspector-header">
        <div>
          <span>Inspector</span>
          <h2>${b(c)}</h2>
        </div>
        <button class="kc-icon-button" type="button" data-toggle-inspector>
          ×
        </button>
      </div>

      <section class="kc-inspector-section">
        <p class="kc-section-micro">Controls</p>
        <div class="kc-inline-badges">
          <button class="kc-secondary-button" type="button" data-inspector-action="approve" ${r?"":"disabled"}>Approve</button>
          <button class="kc-secondary-button" type="button" data-inspector-action="reject" ${r?"":"disabled"}>Reject</button>
          <button class="kc-secondary-button" type="button" data-inspector-action="add-to-context" ${(r==null?void 0:r.kind)!=="path"?"disabled":""}>Add to Context</button>
          <button class="kc-secondary-button" type="button" data-inspector-action="validate" ${o.loading?"disabled":""}>Trigger Validation</button>
          <button class="kc-secondary-button" type="button" data-inspector-action="handoff" ${o.loading?"disabled":""}>Quick Handoff</button>
        </div>
        <div class="kc-divider"></div>
        ${N("Selection",(r==null?void 0:r.kind)??"global",u)}
        ${N("Decision",d,r?"Local inspector review state for the current focus.":"Select a node or plan step to review it here.")}
      </section>

      <section class="kc-inspector-section">
        <p class="kc-section-micro">Reasoning</p>
        <p>${b(u)}</p>
        <div class="kc-inline-badges">
          ${p(((Y=x.contextView.confidence)==null?void 0:Y.toUpperCase())??"UNKNOWN")}
          ${p(x.contextView.confidenceDetail??"No confidence detail")}
          ${m("heuristic",x.contextTrace.honesty.heuristic)}
          ${m("low confidence",x.contextTrace.honesty.lowConfidence)}
          ${m("partial scan",x.contextTrace.honesty.partialScan||x.tokenBreakdown.partialScan||x.indexing.partialScan)}
        </div>
      </section>

      <section class="kc-inspector-section">
        <p class="kc-section-micro">Decision inputs</p>
        ${s.length>0?`<div class="kc-stack-list">${s.map(H=>N(H,"impact",l(H))).join("")}</div>`:"<p>No decision inputs are currently surfaced.</p>"}
      </section>

      <section class="kc-inspector-section">
        <p class="kc-section-micro">Lifecycle</p>
        <div class="kc-gate-list">
          ${f("Stage",x.runtimeLifecycle.currentStage,"default")}
          ${f("Validation",x.runtimeLifecycle.validationStatus??"unknown",x.runtimeLifecycle.validationStatus==="error"?"warn":"default")}
        </div>
        <p>${b(x.runtimeLifecycle.nextRecommendedAction??"No runtime lifecycle recommendation is recorded yet.")}</p>
        <p>${b(`Compatibility/debug snapshot${(E==null?void 0:E.sourceRevision)!=null?` · revision ${E.sourceRevision}`:""}${E!=null&&E.generatedAt?` · generated ${E.generatedAt}`:""}.`)}</p>
      </section>

      <section class="kc-inspector-section">
        <p class="kc-section-micro">Token estimate</p>
        <div class="kc-gate-list">
          ${f("Measured",x.measuredUsage.available?x.measuredUsage.totalTokens.toLocaleString("en-US"):"none",x.measuredUsage.available?"success":"default")}
          ${f("Selected",`~${x.tokenAnalytics.selectedTokens.toLocaleString("en-US")}`,"default")}
          ${f("Full repo",`~${x.tokenAnalytics.fullRepoTokens.toLocaleString("en-US")}`,"default")}
          ${f("Saved",`~${x.tokenAnalytics.savingsPercent}%`,"success")}
        </div>
        <p>${b(x.measuredUsage.available?x.measuredUsage.note:x.tokenAnalytics.estimateNote??"No repo-local token estimate is available yet.")}</p>
      </section>

      ${y==="inspection"?`
          <section class="kc-inspector-section">
            <p class="kc-section-micro">MCP usage</p>
            <div class="kc-gate-list">
              ${f("Pack",((K=t.mcpPacks.selectedPack)==null?void 0:K.name)??((W=t.mcpPacks.selectedPack)==null?void 0:W.id)??t.mcpPacks.suggestedPack.name??t.mcpPacks.suggestedPack.id,"default")}
              ${f("Compatible",String(t.mcpPacks.compatibleCapabilities.length),t.mcpPacks.compatibleCapabilities.length>0?"success":"warn")}
              ${f("Top capability",(i==null?void 0:i.id)??"none",i?"success":"warn")}
            </div>
            <p>${b(t.mcpPacks.note)}</p>
          </section>

          <section class="kc-inspector-section">
            <p class="kc-section-micro">Specialist usage</p>
            <div class="kc-gate-list">
              ${f("Active",(a==null?void 0:a.name)??t.specialists.activeSpecialist,"default")}
              ${f("Risk",(a==null?void 0:a.riskPosture)??"unknown",(a==null?void 0:a.riskPosture)==="conservative"?"success":"default")}
              ${f("Tool fit",((a==null?void 0:a.preferredTools)??[]).join(", ")||"none","default")}
            </div>
            <p>${b((a==null?void 0:a.purpose)??t.specialists.safeParallelHint)}</p>
          </section>

          <section class="kc-inspector-section">
            <p class="kc-section-micro">Skills & trace</p>
            ${x.skills.activeSkills.length>0?`<div class="kc-stack-list">${x.skills.activeSkills.slice(0,3).map(H=>I(`${H.name} — ${H.executionTemplate[0]??H.description}`)).join("")}</div>`:"<p>No active skills are currently matched.</p>"}
          </section>
        `:""}

      <section class="kc-inspector-section">
        <p class="kc-section-micro">Command</p>
        ${o.lastResult?`<code class="kc-command-block">${b(o.lastResult.commandLabel)}</code>`:n!=null&&n.command?`<code class="kc-command-block">${b(n.command)}</code>`:"<p>No command recorded for the current state.</p>"}
      </section>
    </div>
  `:`
      <div class="kc-inspector-shell">
        <div class="kc-inspector-header">
          <div>
            <span>Inspector</span>
            <h2>${b(c)}</h2>
          </div>
          <button class="kc-icon-button" type="button" data-toggle-inspector>×</button>
        </div>
        <section class="kc-inspector-section">
          <p class="kc-section-micro">Reasoning</p>
          <p>${b(u)}</p>
        </section>
      </div>
    `}function $a(e,t){var o,$,b,p,m,f,I,N;const n=e.kiwiControl,a=((o=n==null?void 0:n.nextActions.actions[0])==null?void 0:o.action)??e.repoState.title,i=((b=($=e.runtimeDecision)==null?void 0:$.recovery)==null?void 0:b.reason)??((p=n==null?void 0:n.executionPlan.lastError)==null?void 0:p.reason)??(e.validation.errors>0?`${e.validation.errors} validation error${e.validation.errors===1?"":"s"}`:"none"),s=((n==null?void 0:n.execution.recentExecutions.filter(l=>!l.success).length)??0)+((n==null?void 0:n.workflow.steps.filter(l=>l.status==="failed").length)??0),r=e.validation.warnings+e.machineAdvisory.systemHealth.warningCount,c=e.validation.errors>0||e.machineAdvisory.systemHealth.criticalCount>0?"blocked":r>0?"attention":"healthy",u=t.isLoadingRepoState?"loading":t.isRefreshingFreshRepoState||t.hasWarmSnapshot?"guarded":c==="blocked"?"blocked":(n==null?void 0:n.contextView.confidence)==="low"||n!=null&&n.indexing.partialScan?"guarded":"ready",d=[(m=n==null?void 0:n.execution.recentExecutions[0])==null?void 0:m.timestamp,(f=n==null?void 0:n.runtimeLifecycle.recentEvents[0])==null?void 0:f.timestamp,(I=n==null?void 0:n.feedback.recentEntries[0])==null?void 0:I.timestamp].filter(l=>!!l),y=d.length>0?t.formatTimestamp(((N=d.map(l=>new Date(l)).sort((l,x)=>x.getTime()-l.getTime())[0])==null?void 0:N.toISOString())??""):"unknown";return{nextAction:a,blockingIssue:i,systemHealth:c,executionSafety:u,lastChangedAt:y,recentFailures:s,newWarnings:r}}function ya(e){const t=[{label:"Planning",score:e.optimizationScore.planning.score,missingSignals:e.optimizationScore.planning.missingSignals},{label:"Execution",score:e.optimizationScore.execution.score,missingSignals:e.optimizationScore.execution.missingSignals},{label:"Assistant",score:e.optimizationScore.assistant.score,missingSignals:e.optimizationScore.assistant.missingSignals}],n=[...t].sort((y,o)=>o.score-y.score)[0],a=[...t].sort((y,o)=>y.score-o.score)[0],i=e.guidance.find(y=>y.priority==="critical")??e.guidance.find(y=>y.priority==="recommended")??null,s=(i==null?void 0:i.fixCommand)??(i==null?void 0:i.hintCommand)??"Run kiwi-control usage",r=(i==null?void 0:i.message)??a.missingSignals[0]??"No major machine gaps detected.",c=e.setupSummary.installedTools.readyCount<e.setupSummary.installedTools.totalCount||e.setupSummary.healthyConfigs.readyCount<e.setupSummary.healthyConfigs.totalCount||!e.setupSummary.readyRuntimes.planning||!e.setupSummary.readyRuntimes.execution||!e.setupSummary.readyRuntimes.assistant,u=a.score<70,d=e.stale?"stale":e.systemHealth.criticalCount>0||c||u||e.systemHealth.warningCount>0?"partial":"ready";return{overallStatus:d,overallTone:d==="ready"?"success":"warn",title:d==="ready"?"Machine setup is ready":d==="stale"?"Machine advisory is stale":"Machine setup needs attention",detail:d==="ready"?"Fresh machine signals show the primary runtimes and configs in good shape.":d==="stale"?"Refresh the machine advisory before trusting setup guidance or suggested fixes.":"At least one install, config, or runtime gap is still active for this machine.",bestHeuristicLabel:`${n.label} heuristic`,bestHeuristicValue:`${n.score}%`,strongestGapLabel:i?"Strongest gap":`${a.label} gap`,strongestGapDetail:r,nextFixLabel:"Next recommended fix",nextFixCommand:s}}function wa(e){const t=e.state.kiwiControl,n=t.nextActions.actions[0]??null,a=e.state.specialists.activeProfile,i=e.state.mcpPacks.compatibleCapabilities[0]??null,s=t.decisionLogic.inputSignals.slice(0,e.activeMode==="execution"?3:5),r=e.resolveFocusedStep(e.focusedItem),c=e.resolveFocusedNode(e.focusedItem),u=(r==null?void 0:r.displayTitle)??(c==null?void 0:c.name)??(n==null?void 0:n.action)??"No blocking action",d=(r==null?void 0:r.displayNote)??(c==null?void 0:c.path)??(n==null?void 0:n.reason)??t.nextActions.summary??e.state.repoState.detail;return{state:e.state,primaryAction:n,activeSpecialist:a,topCapability:i,signalItems:s,focusedStep:r,focusedNode:c,focusedItem:e.focusedItem,focusedLabel:u,focusedReason:d,marker:e.marker,activeMode:e.activeMode,commandState:e.commandState}}function xa(e){const{state:t,activeMode:n,helpers:a}=e,{escapeHtml:i,escapeAttribute:s,iconSvg:r,iconLabel:c,renderHeaderBadge:u,renderPanelHeader:d,renderInlineBadge:y,renderNoteRow:o,renderEmptyState:$,renderStatCard:b,renderInfoRow:p,formatInteger:m,formatPercent:f,formatCurrency:I,formatTimestamp:N}=a,l=t.machineAdvisory,x=ya(l),E={critical:l.guidance.filter(k=>k.group==="critical-issues"),recommended:l.guidance.filter(k=>k.group==="improvements"),optional:l.guidance.filter(k=>k.group==="optional-optimizations")},Y=(k,X)=>`
    <div class="kc-table-shell">
      <table class="kc-data-table">
        <thead>
          <tr>${k.map(xe=>`<th>${i(xe)}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${X.map(xe=>`<tr>${xe.map(sa=>`<td>${sa}</td>`).join("")}</tr>`).join("")}
        </tbody>
      </table>
    </div>
  `,K=(k,X,xe)=>`<span class="kc-machine-state ${k?"is-active":"is-inactive"}">${i(k?X:xe)}</span>`,W=k=>`
    <div class="kc-inline-badges kc-machine-freshness">
      ${u(k.status,k.status==="fresh"?"success":k.status==="cached"?"neutral":"warn")}
      ${y(k.updatedAt?N(k.updatedAt):"unknown time")}
      ${k.reason?y(k.reason):""}
    </div>
  `,H=k=>`${k.status}${k.updatedAt?` · ${N(k.updatedAt)}`:""}${k.reason?` · ${k.reason}`:""}`,je=k=>{const X=[k.fixCommand,k.hintCommand].filter(Boolean).join(" | ");return`
      <div class="kc-note-row">
        <div>
          <strong>${i(k.message)}</strong>
          <span>${i(k.reason??`section: ${k.section}`)}</span>
          <span>${i(k.impact)}</span>
        </div>
        <em class="${k.priority==="critical"?"tone-warn":""}">${i(X||k.priority)}</em>
      </div>
    `},vt=(k,X)=>`
    <div class="kc-stack-block">
      <p class="kc-stack-label">${i(k)}</p>
      <div class="kc-stack-list">
        ${X.map(xe=>je(xe)).join("")}
      </div>
    </div>
  `;return`
    <div class="kc-view-shell">
      <section class="kc-view-header">
        <div>
          <p class="kc-view-kicker">Machine Advisory</p>
          <h1>Machine State</h1>
          <p>Read-only machine setup guidance. Repo-local Kiwi state still wins. Generated by ${i(l.generatedBy)}.</p>
        </div>
        ${u(l.stale?"stale":"fresh",l.stale?"warn":"success")}
      </section>

      <section class="kc-panel kc-panel-primary" data-render-section="machine-setup-readiness">
        <div class="kc-panel-heading">
          <div class="kc-panel-kicker">
            ${c(r("system"),"Setup Readiness")}
            ${u(x.overallStatus,x.overallTone==="success"?"success":"warn")}
          </div>
          <h1>${i(x.title)}</h1>
          <p>${i(x.detail)}</p>
        </div>
        <div class="kc-two-column">
          <section class="kc-subpanel">
            <div class="kc-stack-list">
              ${o(x.bestHeuristicLabel,x.bestHeuristicValue,"Heuristic completeness from inspected machine signals.")}
              ${o(x.strongestGapLabel,x.overallStatus,x.strongestGapDetail)}
            </div>
          </section>
          <section class="kc-subpanel">
            <div class="kc-stack-list">
              ${o(x.nextFixLabel,x.nextFixCommand,x.overallStatus==="stale"?"Refresh this first, then trust the detailed setup guidance below.":"Run this next to improve machine readiness or inspect the remaining gap.")}
            </div>
          </section>
        </div>
      </section>

      <div class="kc-stat-grid">
        ${b("Critical",String(l.systemHealth.criticalCount),"fix first",l.systemHealth.criticalCount>0?"critical":"neutral")}
        ${b("Warnings",String(l.systemHealth.warningCount),"recommended actions",l.systemHealth.warningCount>0?"warn":"neutral")}
        ${b("Healthy",String(l.systemHealth.okCount),"healthy checks","success")}
        ${b("Planning Heuristic",`${l.optimizationScore.planning.score}%`,`${l.optimizationScore.planning.earnedPoints}/${l.optimizationScore.planning.maxPoints} signal points`,"neutral")}
        ${b("Execution Heuristic",`${l.optimizationScore.execution.score}%`,`${l.optimizationScore.execution.earnedPoints}/${l.optimizationScore.execution.maxPoints} signal points`,"neutral")}
        ${b("Assistant Heuristic",`${l.optimizationScore.assistant.score}%`,`${l.optimizationScore.assistant.earnedPoints}/${l.optimizationScore.assistant.maxPoints} signal points`,"neutral")}
        ${b("Claude MCPs",String(l.mcpInventory.claudeTotal),"configured servers","neutral")}
        ${b("Codex MCPs",String(l.mcpInventory.codexTotal),"configured servers","neutral")}
        ${b("Copilot MCPs",String(l.mcpInventory.copilotTotal),"configured servers","neutral")}
        ${b("Skills",String(l.skillsCount),"agent skills in ~/.agents/skills","neutral")}
        ${b("Window",`${l.windowDays} days`,l.note,l.stale?"warn":"success")}
      </div>

      <section class="kc-panel">
        ${d("Setup Summary","Borrowed from ai-setup-style machine completion checks, but kept repo-local and read-only.")}
        <div class="kc-two-column">
          <section class="kc-subpanel">
            <div class="kc-stack-list">
              ${o("Installed tools",`${l.setupSummary.installedTools.readyCount}/${l.setupSummary.installedTools.totalCount}`,"Machine-local toolchain presence across the tracked inventory.")}
              ${o("Healthy configs",`${l.setupSummary.healthyConfigs.readyCount}/${l.setupSummary.healthyConfigs.totalCount}`,"Validated config and hook surfaces across Claude, Codex, and Copilot.")}
              ${o("Active token layers",String(l.setupSummary.activeTokenLayers.length),l.setupSummary.activeTokenLayers.length>0?l.setupSummary.activeTokenLayers.join(", "):"No token-optimization layers are currently active.")}
            </div>
          </section>
          <section class="kc-subpanel">
            <div class="kc-stack-list">
              ${o("Planning runtime",l.setupSummary.readyRuntimes.planning?"ready":"needs work",l.optimizationScore.planning.activeSignals.join(", ")||"No active planning signals detected.")}
              ${o("Execution runtime",l.setupSummary.readyRuntimes.execution?"ready":"needs work",l.optimizationScore.execution.activeSignals.join(", ")||"No active execution signals detected.")}
              ${o("Assistant runtime",l.setupSummary.readyRuntimes.assistant?"ready":"needs work",l.optimizationScore.assistant.activeSignals.join(", ")||"No active assistant signals detected.")}
            </div>
          </section>
        </div>
      </section>

      <section class="kc-panel">
        ${d("Optimization Heuristic","Heuristic completeness score calculated from inspected machine signals. This is advisory only and never overrides repo-local Kiwi state.")}
        <div class="kc-two-column">
          <section class="kc-subpanel">
            <div class="kc-stack-list">
              ${o("Planning",`${l.optimizationScore.planning.score}%`,`${l.optimizationScore.planning.earnedPoints}/${l.optimizationScore.planning.maxPoints} points · active: ${l.optimizationScore.planning.activeSignals.join(", ")||"none"}`)}
              ${o("Execution",`${l.optimizationScore.execution.score}%`,`${l.optimizationScore.execution.earnedPoints}/${l.optimizationScore.execution.maxPoints} points · active: ${l.optimizationScore.execution.activeSignals.join(", ")||"none"}`)}
              ${o("Assistant",`${l.optimizationScore.assistant.score}%`,`${l.optimizationScore.assistant.earnedPoints}/${l.optimizationScore.assistant.maxPoints} points · active: ${l.optimizationScore.assistant.activeSignals.join(", ")||"none"}`)}
            </div>
          </section>
          <section class="kc-subpanel">
            <div class="kc-stack-list">
              ${o("Planning gaps",String(l.optimizationScore.planning.missingSignals.length),l.optimizationScore.planning.missingSignals.join(", ")||"No planning gaps detected.")}
              ${o("Execution gaps",String(l.optimizationScore.execution.missingSignals.length),l.optimizationScore.execution.missingSignals.join(", ")||"No execution gaps detected.")}
              ${o("Assistant gaps",String(l.optimizationScore.assistant.missingSignals.length),l.optimizationScore.assistant.missingSignals.join(", ")||"No assistant gaps detected.")}
            </div>
          </section>
        </div>
      </section>

      <section class="kc-panel">
        ${d("Machine Setup Provenance","Structured provenance of the machine-local setup, grouped by phase.")}
        ${W(l.sections.setupPhases)}
        ${l.setupPhases.length>0?l.setupPhases.map(k=>`
              <div class="kc-stack-block">
                <p class="kc-stack-label">${i(k.phase)}</p>
                <div class="kc-stack-list">
                  ${k.items.map(X=>o(tt(X.name),X.active?"active":"inactive",`${Sa(X.name,X.description)} · ${Ca(X.location)}`)).join("")}
                </div>
              </div>
            `).join('<div class="kc-divider"></div>'):$("No machine-local setup provenance is available.")}
      </section>

      <section class="kc-panel">
        ${d("Config Health","Machine-level config and hook surfaces.")}
        ${W(l.sections.configHealth)}
        ${l.configHealth.length>0?Y(["Config","Status","Description"],l.configHealth.map(k=>[i(k.path),K(k.healthy,"healthy","issue"),i(k.description)])):$("No config health data is available.")}
      </section>

      <section class="kc-panel">
        ${d(`Token Usage (Last ${l.windowDays} Days)`,"Measured usage from Claude and Codex local sources.")}
        ${W(l.sections.usage)}
        <div class="kc-two-column">
          <section class="kc-subpanel">
            ${d("Claude Code (via ccusage)",l.usage.claude.note)}
            <div class="kc-stack-list">
              ${o("Total",l.usage.claude.available?`${m(l.usage.claude.totals.totalTokens)} tokens`:"unavailable",l.usage.claude.totals.totalCost!=null?`cache ${f(l.usage.claude.totals.cacheHitRatio)} · cost ${I(l.usage.claude.totals.totalCost)}`:l.usage.claude.note)}
            </div>
            <div class="kc-divider"></div>
            ${l.usage.claude.days.length>0?Y(["Date","Input","Output","Cache Read","Cost","Models"],l.usage.claude.days.map(k=>[i(k.date),i(m(k.inputTokens)),i(m(k.outputTokens)),i(m(k.cacheReadTokens)),i(I(k.totalCost)),i(k.modelsUsed.join(", ")||"—")])):$(l.usage.claude.note)}
          </section>
          <section class="kc-subpanel">
            ${d("Codex (via session logs)",l.usage.codex.note)}
            <div class="kc-stack-list">
              ${o("Total",l.usage.codex.available?`${m(l.usage.codex.totals.totalTokens)} tokens`:"unavailable",l.usage.codex.available?`cache ${f(l.usage.codex.totals.cacheHitRatio)} · sessions ${m(l.usage.codex.totals.sessions)}`:l.usage.codex.note)}
            </div>
            <div class="kc-divider"></div>
            ${l.usage.codex.days.length>0?Y(["Date","Input","Output","Cached","Sessions"],l.usage.codex.days.map(k=>[i(k.date),i(m(k.inputTokens)),i(m(k.outputTokens)),i(m(k.cachedInputTokens)),i(m(k.sessions))])):$(l.usage.codex.note)}
          </section>
        </div>
        <div class="kc-divider"></div>
        <div class="kc-stack-list">
          ${o("Copilot CLI",l.usage.copilot.available?"available":"unavailable",l.usage.copilot.note)}
        </div>
      </section>

      <section class="kc-panel">
        ${d("Guidance","Assistive machine-local suggestions and repo hints. These are advisory only and never auto-applied.")}
        ${W(l.sections.guidance)}
        ${l.guidance.length>0?`
            ${E.critical.length>0?vt("Critical Issues",E.critical):""}
            ${E.recommended.length>0?vt("Improvements",E.recommended):""}
            ${E.optional.length>0?vt("Optional Optimizations",E.optional):""}
          `:$("No machine-local suggestions are currently recorded.")}
      </section>

      <section class="kc-panel">
        ${d("System Details","Expanded machine diagnostics for inspection mode.")}
        ${n==="inspection"?`
            <details class="kc-fold-card" open>
              <summary><strong>Toolchain inventory</strong><span>${i(H(l.sections.inventory))}</span></summary>
              <div class="kc-fold-body">
                ${l.inventory.length>0?Y(["Tool","Version","Phase","Status"],l.inventory.map(k=>[i(tt(k.name)),i(k.version),i(k.phase),K(k.installed,"installed","missing")])):$("No machine-local tool inventory is available.")}
              </div>
            </details>
            <details class="kc-fold-card">
              <summary><strong>MCP servers</strong><span>${i(H(l.sections.mcpInventory))}</span></summary>
              <div class="kc-fold-body">
                <div class="kc-info-grid">
                  ${p("Planning runtime",m(l.mcpInventory.claudeTotal))}
                  ${p("Execution runtime",m(l.mcpInventory.codexTotal))}
                  ${p("Assistant runtime",m(l.mcpInventory.copilotTotal))}
                </div>
                <div class="kc-divider"></div>
                ${l.mcpInventory.tokenServers.length>0?Y(["Server","Planning","Execution","Assistant"],l.mcpInventory.tokenServers.map(k=>[i(tt(k.name)),K(k.claude,"active","—"),K(k.codex,"active","—"),K(k.copilot,"active","—")])):$("No token-focused MCP inventory is available.")}
              </div>
            </details>
            <details class="kc-fold-card">
              <summary><strong>Optimization layers</strong><span>${i(H(l.sections.optimizationLayers))}</span></summary>
              <div class="kc-fold-body">
                ${l.optimizationLayers.length>0?Y(["Layer","Savings","Planning","Execution","Assistant"],l.optimizationLayers.map(k=>[i(tt(k.name)),i(k.savings),K(k.claude,"yes","no"),K(k.codex,"yes","no"),K(k.copilot,"yes","no")])):$("No optimization layer data is available.")}
              </div>
            </details>
            <details class="kc-fold-card">
              <summary><strong>Config health</strong><span>${i(H(l.sections.configHealth))}</span></summary>
              <div class="kc-fold-body">
                ${l.configHealth.length>0?Y(["Config","Status","Description"],l.configHealth.map(k=>[i(k.path),K(k.healthy,"healthy","issue"),i(k.description)])):$("No config health data is available.")}
              </div>
            </details>
          `:$("Switch to inspection mode to expand raw machine internals.")}
      </section>
    </div>
  `}function tt(e){const t=e.trim().toLowerCase();return t==="code-review-graph"?"Structural repo graph":t==="omc"?"Planning orchestration layer":t==="omx"?"Execution orchestration layer":t==="lean-ctx"?"Shell compression layer":t==="context-mode"?"Sandboxed context layer":t==="ccusage"?"Usage telemetry collector":t==="copilot"?"Assistant CLI":t==="ai-setup script"?"Machine bootstrap helper":t.startsWith("copilot plugins")?e.replace(/copilot plugins/i,"Assistant plugins"):e.replace(/[-_]/g," ")}function Sa(e,t){const n=e.trim().toLowerCase();return n==="code-review-graph"?"Structural repo search and graph-backed code lookup":n==="omc"?"Multi-agent planning and review orchestration":n==="omx"?"Multi-agent execution orchestration":n==="lean-ctx"?"Shell output compression for lower-noise local runs":n==="context-mode"?"Sandboxed tool output and context shaping":n==="ccusage"?"Machine-local usage telemetry source":n==="copilot"?"Editor assistant command-line surface":n==="ai-setup script"?"Machine bootstrap entrypoint":t}function Ca(e){return e.replace(/Claude Code/gi,"planning runtime").replace(/Codex/gi,"execution runtime").replace(/Copilot CLI/gi,"assistant runtime").replace(/~\/\.copilot/gi,"~/.assistant").replace(/~\/\.claude/gi,"~/.planner").replace(/~\/\.codex/gi,"~/.execution")}function Ra(e){var y;const{runtimeInfo:t,targetRoot:n,repoMode:a}=e;if(!(!n||a==="repo-not-initialized"||(t==null?void 0:t.runtimeMode)==="installed-user"&&!t.cli.installed))return null;const s=[];n||s.push({id:"choose-repo",label:"Choose Repo",detail:"Pick the folder you want Kiwi Control to open and inspect."}),(t==null?void 0:t.runtimeMode)==="installed-user"&&t.cli.bundledInstallerAvailable&&!t.cli.installed&&s.push({id:"install-cli",label:"Install kc",detail:`Install ${t.cli.installBinDir} into your normal user flow so Terminal can run kc.`}),n&&a==="repo-not-initialized"&&s.push({id:"init-repo",label:"Initialize Repo",detail:"Create the repo-local Kiwi control files for this folder without leaving the app."});const r=t?`${Pa(t.runtimeMode)} · ${Aa(t.buildSource)} · v${t.appVersion}`:"Desktop shell is running, but runtime details are still loading.",c=t!=null&&t.cli.installed?`Installed at ${t.cli.installedCommandPath??t.cli.installBinDir}`:(t==null?void 0:t.runtimeMode)==="installed-user"?"Not installed yet. Kiwi can install kc from the app.":"Source/developer mode detected. Use the source CLI or install the beta CLI separately if needed.",u=n?a==="repo-not-initialized"?`${n} needs repo-local initialization before normal work begins.`:`${n} is open in Kiwi Control.`:"No repo is open yet.",d=((y=s[0])==null?void 0:y.detail)??"Repo, CLI, and desktop setup are already aligned.";return{title:"Get Kiwi Ready",intro:"Kiwi stays repo-local. This first-run flow makes the installed desktop and kc CLI behave like one product without a manual terminal setup dance.",desktopStatus:r,cliStatus:c,repoStatus:u,nextAction:d,actions:s,note:(t==null?void 0:t.runtimeMode)==="installed-user"?"During beta, kc installed from the desktop depends on the Kiwi Control desktop app remaining installed.":"Developer/source mode keeps the source checkout in control of desktop launching."}}function Ta(e,t){const{escapeHtml:n,renderPanelHeader:a,renderNoteRow:i}=t;return`
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
                    <button class="kc-secondary-button" type="button" data-onboarding-action="${n(s.id)}" ${s.disabled?"disabled":""}>${n(s.label)}</button>
                  </div>
                `).join(""):i("Ready","No setup steps left",e.note)}
          </div>
        </section>
      </div>
      <p class="kc-section-note">${n(e.note)}</p>
    </section>
  `}function Pa(e){return e==="installed-user"?"Installed user mode":"Developer source mode"}function Aa(e){switch(e){case"installed-bundle":return"installed app";case"source-bundle":return"source bundle";default:return"fallback launcher"}}const La=new Set(["plan","next","retry","resume","guide","review","prepare","validate","explain","trace","doctor","eval","init","status","check","sync","checkpoint","handoff","run","ui","dispatch","fanout","collect","reconcile","push-check"]);function be(e,t){const n=e==null?void 0:e.trim();if(!n)return"";const a=Na(n);if(a.length===0)return n;const[i="",s=""]=a;if(!["kiwi-control","kc","shrey-junior","sj"].includes(i))return n;const r=["kc",...a.slice(1)];return!t||t.trim().length===0||!La.has(s)||a.includes("--target")?r.map(en).join(" "):[...r,"--target",t].map(en).join(" ")}function Ia(e){return e.slice(0,6).map(t=>({title:t.file,metric:t.dependencyChain&&t.dependencyChain.length>1?"selected · chained":"selected",note:[t.selectionWhy??t.reasons.join(", "),t.dependencyChain&&t.dependencyChain.length>1?`chain: ${t.dependencyChain.join(" -> ")}`:null].filter(Boolean).join(" · ")}))}function Ea(e){var s,r,c,u,d,y,o;if(!e.executionPlan.blocked&&((s=e.recoveryGuidance)==null?void 0:s.tone)!=="blocked")return[];const t=[],n=new Set,a=e.executionPlan.steps.find($=>$.status==="failed")??e.executionPlan.steps[e.executionPlan.currentStepIndex]??null,i=($,b,p)=>{const m=be(b,e.targetRoot);!m||n.has(m)||(n.add(m),t.push({title:$,command:m,detail:p}))};i(Ma((r=e.executionPlan.lastError)==null?void 0:r.fixCommand),((c=e.executionPlan.lastError)==null?void 0:c.fixCommand)??((u=e.recoveryGuidance)==null?void 0:u.nextCommand),((d=e.executionPlan.lastError)==null?void 0:d.reason)??((y=e.recoveryGuidance)==null?void 0:y.detail)??"Review the current workflow blocker before changing repo-local state."),a&&i(a.status==="failed"?`Re-run ${a.id}`:`Run ${a.id}`,a.command,a.validation||"Run the blocked workflow step again after reviewing the blocker."),i("Then retry",(o=e.executionPlan.lastError)==null?void 0:o.retryCommand,"Use this after the blocking issue is cleared.");for(const[$,b]of e.executionPlan.nextCommands.entries())i($===0?"Continue with the next planned step":`Continue with planned step ${$+1}`,b,"Resume the remaining workflow once the blocker is resolved.");return t.slice(0,4)}function Ma(e){return e?/\bprepare\b/i.test(e)?"Refresh the prepared scope":/\bdoctor\b/i.test(e)?"Check the environment":/\bexplain\b/i.test(e)?"Inspect the blocker":"Fix the blocking issue":"Inspect the blocker"}function Na(e){return[...e.matchAll(/"([^"]*)"|'([^']*)'|`([^`]*)`|([^\s]+)/g)].map(n=>n[1]??n[2]??n[3]??n[4]??"").filter(Boolean)}function en(e){return/^[A-Za-z0-9_./:@%+=,-]+$/.test(e)?e:`"${e.replace(/(["\\$`])/g,"\\$1")}"`}function Rn(e,t){var n,a,i,s,r,c;return t.commandState.loading?{phase:"refreshing",visible:!0,label:"Running command",detail:t.commandState.activeCommand?`Executing ${t.commandState.activeCommand}...`:"Executing command...",progress:68,tone:"running",nextCommand:null}:t.isLoadingRepoState&&e.loadState.source!=="warm-snapshot"&&e.loadState.source!=="stale-snapshot"?{phase:"opening",visible:!0,label:t.currentLoadSource==="auto"?"Refreshing repo":"Opening repo",detail:t.currentLoadSource==="cli"?"Desktop launched. Kiwi is loading repo-local state now.":t.currentLoadSource==="auto"?"Refreshing repo-local state in the background.":"Building the repo-local control surface.",progress:t.currentLoadSource==="auto"?55:42,tone:"loading",nextCommand:null}:t.isRefreshingFreshRepoState&&ja(e.loadState.source)?t.lastRepoLoadFailure?{phase:"degraded",visible:!0,label:((n=t.recoveryGuidance)==null?void 0:n.title)??"Using cached snapshot",detail:((a=t.recoveryGuidance)==null?void 0:a.detail)??`Fresh repo-local state could not be loaded: ${t.lastRepoLoadFailure}`,progress:74,tone:((i=t.recoveryGuidance)==null?void 0:i.tone)==="blocked"?"blocked":"degraded",nextCommand:((s=t.recoveryGuidance)==null?void 0:s.nextCommand)??null}:{phase:"warm_loaded",visible:!0,label:e.loadState.source==="stale-snapshot"?"Older snapshot loaded":"Warm state loaded",detail:e.loadState.detail,progress:e.loadState.source==="stale-snapshot"?58:64,tone:"warm",nextCommand:((r=t.recoveryGuidance)==null?void 0:r.nextCommand)??null}:t.recoveryGuidance&&(t.recoveryGuidance.tone==="blocked"||t.recoveryGuidance.tone==="failed")?{phase:t.recoveryGuidance.tone==="failed"?"failed":"ready",visible:!0,label:t.recoveryGuidance.title,detail:t.recoveryGuidance.detail,progress:t.recoveryGuidance.tone==="failed"?100:96,tone:t.recoveryGuidance.tone==="failed"?"degraded":"blocked",nextCommand:t.recoveryGuidance.nextCommand}:e.loadState.source==="bridge-fallback"?{phase:"failed",visible:!0,label:e.readiness.label,detail:t.lastRepoLoadFailure??e.readiness.detail,progress:18,tone:e.readiness.tone==="failed"?"degraded":"blocked",nextCommand:e.readiness.nextCommand}:t.lastReadyStateSignal&&Date.now()-t.lastReadyStateSignal.at<t.readyStatePulseMs?{phase:"ready",visible:!0,label:e.readiness.label,detail:t.machineHydrationInFlight?`${t.lastReadyStateSignal.detail} ${t.machineHydrationDetail}`:e.readiness.detail,progress:100,tone:e.readiness.tone==="blocked"?"blocked":e.readiness.tone==="failed"?"degraded":"ready",nextCommand:e.readiness.nextCommand}:t.currentTargetRoot&&t.machineHydrationInFlight?{phase:"refreshing",visible:!0,label:e.readiness.label,detail:e.readiness.tone==="blocked"?e.readiness.detail:`${e.readiness.detail} ${t.machineHydrationDetail}`,progress:88,tone:e.readiness.tone==="blocked"?"blocked":e.readiness.tone==="failed"?"degraded":"ready",nextCommand:e.readiness.nextCommand}:t.currentTargetRoot&&t.isMachineHeavyViewActive&&t.machineAdvisoryStale?{phase:"warm_loaded",visible:!0,label:"System data deferred",detail:"Kiwi keeps heavy machine diagnostics off the startup path and hydrates them when this view is active.",progress:66,tone:"warm",nextCommand:null}:{phase:t.currentTargetRoot?"ready":"opening",visible:!1,label:"",detail:"",progress:100,tone:"ready",nextCommand:((c=t.recoveryGuidance)==null?void 0:c.nextCommand)??null}}function Fa(e,t){const n=Rn(e,t);return n.visible?{label:n.label,detail:n.detail}:e.targetRoot?{label:e.readiness.label,detail:e.readiness.detail}:{label:"opening",detail:"Run kc ui inside a repo to load it automatically."}}function Ha(e){if(!e.targetRoot)return"Run kc ui inside a repo to load it automatically.";switch(e.repoState.mode){case"healthy":return"Repo-local state is loaded and ready.";case"repo-not-initialized":return"This folder is not initialized yet. Run kc init in Terminal to get started.";case"initialized-invalid":return"This repo needs repair before continuity is fully trustworthy.";case"initialized-with-warnings":return"Repo is usable with a few warnings worth addressing.";case"bridge-unavailable":default:return"Confirm kiwi-control works in Terminal, then run kc ui again."}}function Da(e,t){if(e.readiness.detail)return e.readiness.detail;const a=`Fresh repo-local state is ready for ${Se(e.targetRoot||t)}.`;switch(e.repoState.mode){case"healthy":return a;case"initialized-invalid":return`${a} The repo is loaded, but workflow execution is still blocked until the repo contract is repaired.`;case"repo-not-initialized":return`${a} This repo still needs kc init before the normal workflow can continue.`;case"initialized-with-warnings":return`${a} The repo is usable, but Kiwi still sees warning-level issues worth addressing.`;case"bridge-unavailable":default:return a}}function _a(e,t,n){if(!e.targetRoot)return n.activeTargetHint;if(e.repoState.mode==="bridge-unavailable")return"Confirm kiwi-control works in Terminal, then run kc ui again.";if(n.recoveryGuidance){const a=n.recoveryGuidance.nextCommand?` Do this now: ${n.recoveryGuidance.nextCommand}.`:"";return`${n.recoveryGuidance.detail}${a} ${n.activeTargetHint}`}if(e.readiness.detail){const a=e.readiness.nextCommand?` Do this now: ${e.readiness.nextCommand}.`:"";return`${e.readiness.detail}${a} ${n.activeTargetHint}`}return n.lastReadyStateSignal&&Date.now()-n.lastReadyStateSignal.at<n.readyStatePulseMs?n.machineHydrationInFlight?`${n.lastReadyStateSignal.detail} ${n.machineHydrationDetail} ${n.activeTargetHint}`:`${n.lastReadyStateSignal.detail} ${n.activeTargetHint}`:e.loadState.source==="stale-snapshot"?`Showing ${Se(e.targetRoot)} from an older snapshot while Kiwi refreshes current repo-local state. ${n.activeTargetHint}`:e.loadState.source==="warm-snapshot"?`Showing ${Se(e.targetRoot)} from a recent warm snapshot while fresh repo-local state refreshes. ${n.activeTargetHint}`:n.machineHydrationInFlight?`Fresh repo-local state is ready for ${Se(e.targetRoot)}. ${n.machineHydrationDetail} ${n.activeTargetHint}`:t==="cli"?`Loaded ${Se(e.targetRoot)} from kc ui. ${n.activeTargetHint}`:t==="manual"?`Loaded ${Se(e.targetRoot)}. ${n.activeTargetHint}`:t==="auto"?`Refreshed ${Se(e.targetRoot)}. ${n.activeTargetHint}`:n.activeTargetHint}function ja(e){return e==="warm-snapshot"||e==="stale-snapshot"}function Se(e){const t=e.trim();if(!t)return"repo";const n=t.split(/[\\/]/).filter(Boolean);return n[n.length-1]??t}function Oa(e){const t=new Set(Ba(e.focusPath,e.selectedAnalysis)),n={path:e.rootPath,label:e.rootLabel||"repo",kind:"root",status:"selected",baseX:600,baseY:360,x:600,y:360,radius:34,tone:"tone-root",importance:"high",highlighted:t.has(e.rootPath)},a=[n],i=[],s=[],r=e.tree.nodes.slice(0,10);return r.forEach((c,u)=>{const d=Math.PI*2*u/Math.max(r.length,1),y=600+Math.cos(d)*220,o=360+Math.sin(d)*220,$=tn(c,e.selectedAnalysis),b={path:c.path,label:c.name,kind:c.kind,status:c.status,baseX:y,baseY:o,x:y,y:o,radius:$==="high"?26:$==="medium"?22:18,tone:`tone-${c.status}`,importance:$,highlighted:t.has(c.path)};a.push(b),i.push({fromPath:n.path,toPath:b.path,highlighted:t.has(n.path)&&t.has(b.path)}),s.push({label:c.name,kind:c.kind,meta:`${c.children.length} child nodes`,path:c.path}),!(e.graphDepth<2)&&c.children.slice(0,e.graphDepth>2?6:4).forEach((p,m)=>{const f=d+(m-1.5)*.32,I=b.baseX+Math.cos(f)*160,N=b.baseY+Math.sin(f)*160,l=tn(p,e.selectedAnalysis),x={path:p.path,label:p.name,kind:p.kind,status:p.status,baseX:I,baseY:N,x:I,y:N,radius:l==="high"?18:l==="medium"?16:14,tone:`tone-${p.status}`,importance:l,highlighted:t.has(p.path)};a.push(x),i.push({fromPath:b.path,toPath:x.path,highlighted:t.has(b.path)&&t.has(x.path)}),s.push({label:p.name,kind:p.kind,meta:p.status,path:p.path})})}),{rootPath:e.rootPath,nodes:a,edges:i,summary:s,nodesByPath:new Map(a.map(c=>[c.path,c]))}}function Va(e,t){const n=e.nodes.map(s=>{const r=t.get(s.path)??{x:0,y:0};return{path:s.path,label:s.label,kind:s.kind,status:s.status,x:s.baseX+r.x,y:s.baseY+r.y,radius:s.radius,tone:s.tone,importance:s.importance,highlighted:s.highlighted}}),a=new Map(n.map(s=>[s.path,s])),i=e.edges.map(s=>{const r=a.get(s.fromPath),c=a.get(s.toPath);return{fromPath:s.fromPath,toPath:s.toPath,from:{x:(r==null?void 0:r.x)??0,y:(r==null?void 0:r.y)??0},to:{x:(c==null?void 0:c.x)??0,y:(c==null?void 0:c.y)??0},highlighted:s.highlighted}});return{nodes:n,edges:i,summary:e.summary}}function bt(e,t,n){const a=e.nodesByPath.get(n);if(!a)return null;const i=t.get(n)??{x:0,y:0};return{x:a.baseX+i.x,y:a.baseY+i.y}}function Ba(e,t){var r;if(!e)return[];const n=(r=t.find(c=>c.file===e))==null?void 0:r.dependencyChain;if(n&&n.length>1)return n;const a=e.split(/[\\/]/).filter(Boolean),i=[];let s=e.startsWith("/")?"/":"";for(const c of a)s=s?`${s.replace(/\/$/,"")}/${c}`:c,i.push(s);return i}function tn(e,t){var a;const n=t.find(i=>i.file===e.path);return e.status==="selected"||((n==null?void 0:n.score)??0)>=2||(((a=n==null?void 0:n.dependencyChain)==null?void 0:a.length)??0)>1?"high":e.status==="candidate"||e.children.some(i=>i.status==="selected")?"medium":"low"}const Tn=[{id:"overview",label:"Overview",icon:F("overview")},{id:"context",label:"Context",icon:F("context")},{id:"graph",label:"Graph",icon:F("graph")},{id:"tokens",label:"Tokens",icon:F("tokens")},{id:"feedback",label:"Feedback",icon:F("feedback")},{id:"mcps",label:"MCPs",icon:F("mcps")},{id:"specialists",label:"Specialists",icon:F("specialists")},{id:"system",label:"System",icon:F("system")},{id:"validation",label:"Validation",icon:F("validation")},{id:"machine",label:"Machine",icon:F("system")}],za="Confirm kiwi-control works in Terminal, then run kc ui again.",Pn=4500,An=180,Ln=["inventory","configHealth","mcpInventory"],Ua=["guidance","optimizationLayers","setupPhases","usage"],_={contextView:{task:null,selectedFiles:[],excludedPatterns:[],reason:null,confidence:null,confidenceDetail:null,keywordMatches:[],tree:{nodes:[],selectedCount:0,candidateCount:0,excludedCount:0},timestamp:null},tokenAnalytics:{selectedTokens:0,fullRepoTokens:0,savingsPercent:0,fileCountSelected:0,fileCountTotal:0,estimationMethod:null,estimateNote:null,topDirectories:[],task:null,timestamp:null},efficiency:{instructionsGenerated:!1,instructionsPath:null},nextActions:{actions:[],summary:""},feedback:{totalRuns:0,successRate:0,adaptationLevel:"limited",note:"Adaptive feedback is idle.",basedOnPastRuns:!1,reusedPattern:null,similarTasks:[],recentEntries:[],topBoostedFiles:[],topPenalizedFiles:[]},execution:{totalExecutions:0,totalTokensUsed:0,averageTokensPerRun:0,successRate:0,recentExecutions:[],tokenTrend:"insufficient-data"},wastedFiles:{files:[],totalWastedTokens:0,removalSavingsPercent:0},heavyDirectories:{directories:[]},indexing:{totalFiles:0,observedFiles:0,selectedFiles:0,candidateFiles:0,excludedFiles:0,discoveredFiles:0,analyzedFiles:0,skippedFiles:0,skippedDirectories:0,visitedDirectories:0,maxDepthExplored:0,fileBudgetReached:!1,directoryBudgetReached:!1,partialScan:!1,ignoreRulesApplied:[],skipped:[],indexedFiles:0,indexUpdatedFiles:0,indexReusedFiles:0,impactFiles:0,changedSignals:0,keywordSignals:0,importSignals:0,repoContextSignals:0,scopeArea:null,coverageNote:"Run kiwi-control prepare to record indexing coverage and selection reasoning.",selectionReason:null},fileAnalysis:{totalFiles:0,scannedFiles:0,skippedFiles:0,selectedFiles:0,excludedFiles:0,selected:[],excluded:[],skipped:[]},contextTrace:{initialSignals:{changedFiles:[],recentFiles:[],importNeighbors:[],proximityFiles:[],keywordMatches:[],repoContextFiles:[]},expansionSteps:[],honesty:{heuristic:!0,lowConfidence:!1,partialScan:!1}},tokenBreakdown:{partialScan:!1,categories:[]},decisionLogic:{summary:"",decisionPriority:"low",inputSignals:[],reasoningChain:[],ignoredSignals:[]},runtimeLifecycle:{currentTask:null,currentStage:"idle",validationStatus:null,nextSuggestedCommand:null,nextRecommendedAction:null,recentEvents:[]},executionEvents:{source:"unavailable",latestRevision:null,recentEvents:[]},measuredUsage:{available:!1,source:"none",totalTokens:0,totalRuns:0,runs:[],workflows:[],files:[],note:"No measured token usage is available yet."},skills:{activeSkills:[],suggestedSkills:[],totalSkills:0},workflow:{task:null,status:"pending",currentStepId:null,steps:[]},executionTrace:{steps:[],whyThisHappened:""},executionPlan:{summary:"",state:"idle",currentStepIndex:0,confidence:null,risk:"low",blocked:!1,steps:[],nextCommands:[],lastError:null},repoIntelligence:{reviewPackAvailable:!1,reviewPackPath:null,reviewPackSummary:null}},Ce=document.querySelector("#app"),nn=document.querySelector("#boot-overlay");if(!Ce)throw new Error("App root not found");let M="overview",Te="history",He="all",De=!1,Ye=!0,g=qt(""),Le=Ka(),$e="execution";const an=Wa(),Ga=1e3;let Rt,In,ne,It,se,dt,Tt,Pt,S="",ae=!1,le=!1,Pe=null,it=null,En="",ut=0,Be=!1,pe=new Set,Et=new Set,st=null,te=null,Mn=0,Q=null,ze=!1,ot=!1,he=null,Ne=null,Ve=!1,Mt=0,sn="",Nt=null,on="",nt=null,v={activeCommand:null,loading:!1,composer:null,draftValue:"",lastResult:null,lastError:null},oe=null,L=null,de=new Map,Ue=[],fe=new Map,ge={x:0,y:0},me=1,ie=2,Ie=null,O=null,Z=[],ke=new Set,Ee=new Map,_e=null,ye="",Ft=new Map,ce=0,G=null,ee=null,Je=null,rt=!1,ct=new Set,Re=null,$t=!1,pt=!1;var xn;try{Ce.innerHTML=qa(),Rt=ue(".kc-shell"),In=ue("#rail-nav"),ne=ue("#bridge-note"),It=ue("#topbar"),se=ue("#center-main"),dt=ue("#inspector"),Tt=ue("#log-drawer"),Pt=ue("#workspace-surface"),rn(),D(g),ne.textContent=kt(g,"shell"),Nn(),Ce.addEventListener("click",e=>{const t=e.target;if(!t)return;const n=e,a=t.closest("[data-view]");if(a!=null&&a.dataset.view){const c=a.dataset.view;c!==M&&(M=c,pt=!0),P(),Dt(M,!1);return}if(t.closest("[data-toggle-logs]")){De=!De,P();return}if(t.closest("[data-toggle-inspector]")){Ye=!Ye,P();return}const i=t.closest("[data-log-tab]");if(i!=null&&i.dataset.logTab){Te=i.dataset.logTab,P();return}const s=t.closest("[data-validation-tab]");if(s!=null&&s.dataset.validationTab){He=s.dataset.validationTab,P();return}if(t.closest("[data-theme-toggle]")){Le=Le==="dark"?"light":"dark",rn(),P();return}const r=t.closest("[data-ui-mode]");if(r!=null&&r.dataset.uiMode){$e=r.dataset.uiMode,$e==="execution"&&(De=!1,Te="history"),P();return}Ri(n,t)||t.closest("[data-reload-state]")&&S&&Qe(S,"manual")}),Ce.addEventListener("input",e=>{const t=e.target;if(t){if(t.matches("[data-command-draft]")){v.draftValue=t.value;return}t.matches("[data-plan-edit-input]")&&(ye=t.value)}}),Ce.addEventListener("change",e=>{const t=e.target;t&&t.matches("[data-command-draft]")&&(v.draftValue=t.value)}),Ce.addEventListener("wheel",e=>{const t=e.target;if(!t||!t.closest("[data-graph-surface]"))return;e.preventDefault(),Oe();const n=e.deltaY>0?-.12:.12;me=Math.max(.65,Math.min(2.4,Number((me+n).toFixed(2)))),hn()||At()},{passive:!1}),Ce.addEventListener("pointerdown",e=>{const t=e.target;if(!t)return;const n=t.closest("[data-graph-node]");if(n!=null&&n.dataset.path){Oe(),O={mode:"drag-node",path:n.dataset.path,lastClientX:e.clientX,lastClientY:e.clientY};return}t.closest("[data-graph-surface]")&&(Oe(),O={mode:"pan",lastClientX:e.clientX,lastClientY:e.clientY})}),window.addEventListener("pointermove",e=>{if(!O)return;const t=e.clientX-O.lastClientX,n=e.clientY-O.lastClientY;if(Oe(),O.mode==="pan"){ge={x:ge.x+t,y:ge.y+n},O.lastClientX=e.clientX,O.lastClientY=e.clientY,hn()||At();return}const a=fe.get(O.path)??{x:0,y:0};fe.set(O.path,{x:a.x+t/me,y:a.y+n/me}),O.lastClientX=e.clientX,O.lastClientY=e.clientY,mn(O.path)}),window.addEventListener("pointerup",()=>{(O==null?void 0:O.mode)==="drag-node"&&(Oe(),mn(O.path)),O=null,Ve&&Me()}),window.addEventListener("keydown",e=>{const t=document.activeElement;if(!(t instanceof HTMLInputElement||t instanceof HTMLTextAreaElement||t instanceof HTMLSelectElement)){if(e.altKey&&e.key.toLowerCase()==="g"){e.preventDefault(),V("guide",[],{expectJson:!0});return}if(e.altKey&&e.key.toLowerCase()==="n"){e.preventDefault(),V("next",[],{expectJson:!0});return}if(e.altKey&&e.key.toLowerCase()==="v"){e.preventDefault(),V("validate",[],{expectJson:!0});return}e.altKey&&e.key==="Enter"&&(e.preventDefault(),V("run-auto",[Ot("run-auto")],{expectJson:!1}))}}),Ya()}catch(e){const t=e instanceof Error?`${e.name}: ${e.message}
${e.stack??""}`:String(e);console.error(t),(xn=window.__KIWI_BOOT_API__)==null||xn.renderError(`Synchronous renderer boot failure:
${t}`)}function ue(e){const t=document.querySelector(e);if(!t)throw new Error(`Shell mount point not found: ${e}`);return t}function Ka(){try{const e=window.localStorage.getItem("kiwi-control-theme");if(e==="dark"||e==="light")return e}catch{}return"dark"}function Nn(){const e=window.__KIWI_BOOT_API__;window.requestAnimationFrame(()=>{var n,a,i;if(!(!!((n=It.textContent)!=null&&n.trim())||!!((a=se.textContent)!=null&&a.trim())||!!((i=dt.textContent)!=null&&i.trim()))){e==null||e.renderError("Renderer mounted but produced no visible UI content.");return}e&&(e.mounted=!0),e==null||e.hide(),Vt(g)})}function Wa(){const e=navigator.userAgent.toLowerCase();return e.includes("win")?"windows":e.includes("mac")?"macos":"linux"}function rn(){Rt.dataset.theme=Le,Rt.dataset.platform=an,document.documentElement.dataset.theme=Le,document.documentElement.dataset.platform=an;try{window.localStorage.setItem("kiwi-control-theme",Le)}catch{}}function qa(){return`
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
  `}async function Ya(){if(await Xa())return;await Fn(),await Qa();const e=await aa();e?(await J("ui-initial-launch-request-consumed",e.requestId,e.targetRoot),await ft(e)):await J("ui-initial-launch-request-missing"),window.setInterval(()=>{ni()},250),window.setInterval(()=>{Za()},Ga),window.setInterval(()=>{Ti()},250)}function Ja(){if(j())return null;const e=new URLSearchParams(window.location.search),t=e.get("preview");return t?{fixturePath:e.get("fixture")??`/preview/${t}.json`}:null}async function Xa(){const e=Ja();if(!e)return!1;const t=await fetch(e.fixturePath,{cache:"no-store"});if(!t.ok)throw new Error(`Preview fixture failed to load: ${e.fixturePath}`);const n=await t.json();return g=n.state,S=n.state.targetRoot,te=n.runtimeInfo??null,n.activeView&&(M=n.activeView),n.activeMode&&($e=n.activeMode),ne.textContent=n.state.repoState.detail,D(n.state),gt(`Preview loaded for ${n.activeView??"overview"}.`),!0}async function Qa(){if(j())try{await Qt("desktop-launch-request",e=>{ft(e.payload)}),await Qt("repo-state-changed",e=>{Ht(e.payload)})}catch{}}async function Ht(e){if(!(!e.targetRoot||e.targetRoot!==S)&&!(e.revision<=g.executionState.revision)){if(ae||le||v.loading){it=e;return}await Qe(e.targetRoot,"auto",void 0,{preferSnapshot:!1})}}async function Za(){if(!(!S||!j()||ae||le))try{const e=await U("get_latest_runtime_revision",{targetRoot:S,afterRevision:g.executionState.revision});e>g.executionState.revision&&await Ht({targetRoot:S,revision:e})}catch{}}async function Fn(){if(j())try{te=await U("get_desktop_runtime_info");const e=Xn(te.renderProbeView);e&&(M=e),P()}catch{te=null}}async function ei(){if(!(!j()||v.loading)){v.loading=!0,v.activeCommand=null,v.lastError=null,v.lastResult=null,D(g);try{const e=await U("install_bundled_cli");await Fn(),v.lastResult={ok:!0,exitCode:0,stdout:e.detail,stderr:"",commandLabel:"install kc"}}catch(e){v.lastError=e instanceof Error?e.message:String(e)}finally{v.loading=!1,D(g)}}}async function ti(){if(!(!j()||v.loading))try{const e=await U("pick_repo_directory");if(!e)return;await Qe(e,"manual",void 0,{preferSnapshot:!1})}catch(e){v.lastError=e instanceof Error?e.message:String(e),D(g)}}async function ft(e){if(await J("ui-launch-request-received",e.requestId,e.targetRoot),En=e.requestId,ae){Pe=e,await J("ui-launch-request-queued",e.requestId,e.targetRoot);return}if(S.trim().length>0&&e.targetRoot===S&&g.repoState.mode!=="bridge-unavailable"&&!le){await J("ui-launch-request-attached",e.requestId,e.targetRoot,g.loadState.source),await Wt(S,g.executionState.revision),ne.textContent=kt(g,"cli"),gt(Kt(g)),D(g),await Ge(e.requestId,S,cn(g.loadState.source)?"hydrating":"ready",cn(g.loadState.source)?`Already attached to ${S}. Fresh repo-local state is still hydrating.`:`Already attached to ${S}. Kiwi reused the active runtime-backed desktop session.`,g.executionState.revision);return}await Qe(e.targetRoot,"cli",e.requestId)}async function ni(){if(ae||!j())return;const e=await aa();!e||e.requestId===En||(await J("ui-fallback-launch-request-consumed",e.requestId,e.targetRoot),await ft(e))}async function Qe(e,t,n,a={}){if(ae||le){n&&(Pe={requestId:n,targetRoot:e});return}ae=!0,st=t,S=e,Q=null,Nt=null,oe=null,ne.textContent=t==="cli"?`Opening ${e} from ${n?"kc ui":"the CLI"}...`:t==="auto"?`Refreshing repo-local state for ${e}...`:`Loading repo-local state for ${e}...`,D(g);try{const i=await ia(e,a.preferSnapshot??!1);if(S=i.targetRoot||e,g=i,Mn=Date.now(),await Wt(S,i.executionState.revision),D(i),ne.textContent=kt(i,t),await J("ui-repo-state-rendered",n,i.targetRoot||e,`${i.repoState.mode}:${i.loadState.source}`),(i.loadState.source==="warm-snapshot"||i.loadState.source==="stale-snapshot")&&t!=="auto"){ae=!1,st=null,le=!0,D(g),n&&await Ge(n,S,"hydrating",i.loadState.source==="stale-snapshot"?`Loaded an older repo snapshot for ${S}. Fresh repo-local state is still hydrating.`:`Loaded a warm repo snapshot for ${S}. Fresh repo-local state is still hydrating.`),window.setTimeout(()=>{ai(S,n)},32);return}jn(!1),gt(Kt(i)),P(),n&&await Ge(n,S,i.repoState.mode==="bridge-unavailable"?"error":"ready")}catch(i){if(Q=i instanceof Error?i.message:String(i),(t==="auto"||t==="manual")&&g.targetRoot===e&&g.repoState.mode!=="bridge-unavailable"){ne.textContent=`Kiwi kept the last known repo-local state for ${e}. Refresh failed: ${Q}`,D(g),await J("ui-repo-state-retained-after-refresh-failure",n,e,Q);return}const r=qt(e);g=r,S=r.targetRoot||e,ne.textContent=`Kiwi could not load repo-local state for ${e}. ${Q}`,D(r),await J("ui-repo-state-failed",n,e,Q),n&&await Ge(n,e,"error",Q)}finally{ae=!1,st=null,le||(await Hn(n),await Dn())}}async function ai(e,t){try{const n=await ia(e,!1);S=n.targetRoot||e,g=n,Mn=Date.now(),Q=null,await Wt(S,n.executionState.revision),Yn()?Me():D(n),ne.textContent=kt(n,"manual"),await J("ui-repo-state-refreshed",t,S,n.repoState.mode),jn(!1),gt(Kt(n)),Me(),t&&await Ge(t,S,n.repoState.mode==="bridge-unavailable"?"error":"ready")}catch(n){Q=n instanceof Error?n.message:String(n),ne.textContent=`Showing a warm repo snapshot for ${e}. Fresh refresh failed: ${Q}`,await J("ui-repo-state-refresh-failed",t,e,Q),Me()}finally{le=!1,await Hn(t),await Dn()}}async function Hn(e){if(Pe&&Pe.requestId!==e){const t=Pe;Pe=null,await ft(t);return}Pe=null}async function Dn(){if(!it)return;const e=it;it=null,await Ht(e)}async function Ge(e,t,n,a,i=g.executionState.revision){const s=a??(n==="ready"?`Loaded repo-local state for ${t}.`:n==="hydrating"?`Loaded a warm repo snapshot for ${t}. Fresh repo-local state is still hydrating.`:za);if(j())try{await J("ui-ack-attempt",e,t,n),await U("ack_launch_request",{requestId:e,targetRoot:t,status:n,detail:s,revision:i}),await J("ui-ack-succeeded",e,t,n)}catch(r){ne.textContent="Kiwi Control loaded this repo, but the desktop launch acknowledgement did not complete yet.",await J("ui-ack-failed",e,t,r instanceof Error?r.message:String(r))}}async function J(e,t,n,a){if(j())try{await U("append_ui_launch_log",{event:e,requestId:t,targetRoot:n,detail:a})}catch{}}function cn(e){return e==="warm-snapshot"||e==="stale-snapshot"}function _n(e){return e==="machine"||e==="tokens"||e==="mcps"||e==="system"}function ii(e){return[...new Set(e)]}function si(e){switch(e){case"tokens":return["usage","optimizationLayers"];case"mcps":return["mcpInventory","optimizationLayers"];case"system":return["inventory","configHealth","setupPhases"];case"machine":return["guidance","inventory","configHealth"];default:return Ln}}function oi(e){return _n(e)?ii([...Ln,...Ua]):[]}function ln(e,t){return e.filter(n=>{var a;return Et.has(n)?((a=g.machineAdvisory.sections[n])==null?void 0:a.status)!=="fresh":!0})}function Dt(e,t){if(!S||!j())return;const n=ln(si(e)),a=ln(oi(e).filter(s=>!n.includes(s))),i=++ut;he!=null&&(window.clearTimeout(he),he=null),n.length>0&&dn(t,n,i),a.length>0&&(he=window.setTimeout(()=>{dn(t,a,i),he=null},900))}function jn(e){Dt(M,e)}async function dn(e,t,n){if(!(!j()||t.length===0)){Be=!0;for(const a of t)pe.add(a);if(P(),await Promise.all(t.map(a=>ri(a,e,n))),n!==ut){for(const a of t)pe.delete(a);pe.size===0&&(Be=!1),P();return}for(const a of t)pe.delete(a);pe.size===0&&(Be=!1),P()}}async function ri(e,t,n){try{const a=await U("load_machine_advisory_section",{section:e,refresh:t});if(n!==ut)return;ci(a),Et.add(e),Me()}catch(a){if(n!==ut)return;g.machineAdvisory.sections[e]={status:"partial",updatedAt:new Date().toISOString(),reason:a instanceof Error?a.message:String(a)},Me()}}function ci(e){switch(g.machineAdvisory.sections[e.section]=e.meta,e.section){case"inventory":g.machineAdvisory.inventory=e.data;break;case"mcpInventory":g.machineAdvisory.mcpInventory=e.data;break;case"optimizationLayers":g.machineAdvisory.optimizationLayers=e.data;break;case"setupPhases":g.machineAdvisory.setupPhases=e.data;break;case"configHealth":g.machineAdvisory.configHealth=e.data;break;case"usage":g.machineAdvisory.usage=e.data;break;case"guidance":g.machineAdvisory.guidance=li(e.data);break}g.machineAdvisory.updatedAt=e.meta.updatedAt,g.machineAdvisory.stale=Object.values(g.machineAdvisory.sections).some(t=>t.status!=="fresh"),g.machineAdvisory.systemHealth=di(g.machineAdvisory)}function li(e){var c,u,d,y,o,$;const t=((u=(c=g.kiwiControl)==null?void 0:c.contextView.task)==null?void 0:u.toLowerCase())??"",n=((d=g.kiwiControl)==null?void 0:d.workflow.currentStepId)??null,a=g.validation.errors>0,i=(((y=g.kiwiControl)==null?void 0:y.feedback.totalRuns)??0)>0&&(((o=g.kiwiControl)==null?void 0:o.feedback.successRate)??100)<50,s=(($=g.kiwiControl)==null?void 0:$.workflow.steps.some(b=>b.retryCount>0))??!1,r=a||i||s;return e.filter(b=>!(!r&&b.priority!=="critical"||(/\b(read|inspect|review|summarize)\b/.test(t)||/\bdocs?|document|readme\b/.test(t))&&n==="prepare"&&b.id==="missing-ccusage"))}function di(e){const t=e.guidance.filter(i=>i.priority==="critical").length,n=e.guidance.filter(i=>i.priority==="recommended").length,a=e.inventory.filter(i=>i.installed).length+e.configHealth.filter(i=>i.healthy).length+e.optimizationLayers.filter(i=>i.claude||i.codex||i.copilot).length;return{criticalCount:t,warningCount:n,okCount:a}}function ui(e){const t=e.targetRoot||"";t!==sn&&(sn=t,v={activeCommand:null,loading:!1,composer:null,draftValue:"",lastResult:null,lastError:null},oe=null,L=null,de=new Map,Ue=[],fe=new Map,ge={x:0,y:0},me=1,ie=2,Ie=null,Z=[],ke=new Set,Ee=new Map,_e=null,ye="",Ft=new Map,ce=0,G=null,ee=null,Je=null,ct.clear(),rt=!1,Et.clear(),pe.clear(),Be=!1,he!=null&&(window.clearTimeout(he),he=null)),hi(e),pi(e)}function pi(e){const t=L;if((t==null?void 0:t.kind)==="path"&&!yt(M))L=null;else if((t==null?void 0:t.kind)==="step"&&!wt(M))L=null;else{if((t==null?void 0:t.kind)==="path"&&Un(e,t.path))return;if((t==null?void 0:t.kind)==="step"&&Xe(e).some(s=>s.id===t.id))return}if(!yt(M)&&!wt(M)){L=null;return}const a=Bn(e)[0];if(a&&yt(M)){L={kind:"path",id:a,label:We(a),path:a};return}const i=Xe(e)[0];if(i&&wt(M)){L={kind:"step",id:i.id,label:i.displayTitle};return}L=null}function yt(e){return e==="overview"||e==="context"||e==="graph"}function wt(e){return e==="overview"}function hi(e){const t=(e.kiwiControl??_).executionPlan.steps.map(n=>n.id);if(t.length===0){Z=[],ke.clear(),Ee.clear(),_e=null,ye="";return}Z.length===0?Z=[...t]:Z=[...Z.filter(n=>t.includes(n)),...t.filter(n=>!Z.includes(n))];for(const n of[...ke])t.includes(n)||ke.delete(n);for(const n of[...Ee.keys()])t.includes(n)||Ee.delete(n)}function Ze(e){const t=(e.kiwiControl??_).contextView.tree;if(G&&G.baseTree===t&&G.overrideVersion===ce)return G.tree;const n=t.nodes.map(s=>On(s)),a=Vn(n),i={nodes:n,selectedCount:a.selected,candidateCount:a.candidate,excludedCount:a.excluded};return G={baseTree:t,overrideVersion:ce,tree:i,flatNodes:_t(n)},i}function On(e){const t=de.get(e.path),n=t==null?e.status:t==="include"?"selected":"excluded";return{...e,status:n,children:e.children.map(a=>On(a))}}function Vn(e){return e.reduce((t,n)=>{n.status==="selected"?t.selected+=1:n.status==="candidate"?t.candidate+=1:t.excluded+=1;const a=Vn(n.children);return t.selected+=a.selected,t.candidate+=a.candidate,t.excluded+=a.excluded,t},{selected:0,candidate:0,excluded:0})}function Bn(e){return zn(e).filter(t=>t.kind==="file"&&t.status==="selected").map(t=>t.path)}function _t(e){return e.flatMap(t=>[t,..._t(t.children)])}function zn(e){const t=(e.kiwiControl??_).contextView.tree;return G&&G.baseTree===t&&G.overrideVersion===ce?G.flatNodes:(Ze(e),(G==null?void 0:G.flatNodes)??[])}function Un(e,t){return zn(e).find(n=>n.path===t)??null}function jt(){Ue.push(new Map(de)),Ue.length>20&&Ue.shift()}function xt(e,t){jt(),de.set(e,t),ce+=1,G=null,L={kind:"path",id:e,label:We(e),path:e},Ie=e,P()}function mi(){de.size!==0&&(jt(),de.clear(),ce+=1,G=null,P())}function fi(){const e=Ue.pop();e&&(de=new Map(e),ce+=1,G=null,P())}function Ot(e){var n,a,i,s;if(e==="handoff")return g.specialists.handoffTargets[0]??g.specialists.recommendedSpecialist??"";if(e==="checkpoint")return ve(g.repoOverview,"Current phase")!=="none recorded"?ve(g.repoOverview,"Current phase"):`${Gt(S)} checkpoint`;const t=((a=(n=g.kiwiControl)==null?void 0:n.contextView.task)==null?void 0:a.trim())??"";return t&&t.toLowerCase()!=="task"?t:((s=(i=g.kiwiControl)==null?void 0:i.nextActions.actions[0])==null?void 0:s.action)??""}function Gn(e){const t=(e==null?void 0:e.trim().toLowerCase())??"";return t.length===0||t==="task"}function Kn(e,t,n){var r,c,u,d;const a=(r=e.kiwiControl)==null?void 0:r.executionPlan,i=a==null?void 0:a.steps.find(y=>y.id==="validate"),s=((c=e.runtimeDecision.recovery)==null?void 0:c.fixCommand)??e.runtimeDecision.nextCommand??e.executionState.nextCommand??e.readiness.nextCommand??(i==null?void 0:i.fixCommand)??(i==null?void 0:i.retryCommand)??((u=a==null?void 0:a.lastError)==null?void 0:u.fixCommand)??((d=a==null?void 0:a.lastError)==null?void 0:d.retryCommand)??(a==null?void 0:a.nextCommands[0])??'kiwi-control validate "task"';return t==="run-auto"&&Gn(n)?{blocked:!0,reason:"Enter a real goal instead of the placeholder task.",nextCommand:'kiwi-control prepare "real goal"'}:t==="checkpoint"&&(e.executionState.lifecycle==="blocked"||e.executionState.lifecycle==="failed"||(i==null?void 0:i.status)==="failed"||e.validation.errors>0)?{blocked:!0,reason:"Checkpoint is blocked until validation passes.",nextCommand:s}:t==="handoff"&&(e.executionState.lifecycle==="blocked"||e.executionState.lifecycle==="failed"||(i==null?void 0:i.status)==="failed"||e.validation.errors>0)?{blocked:!0,reason:"Handoff is blocked until validation passes.",nextCommand:s}:{blocked:!1,reason:t==="run-auto"?"Run a concrete goal in the loaded repo.":"Ready to run.",nextCommand:null}}function un(e){v.loading||(oe=null,v.composer===e?(v.composer=null,v.draftValue=""):(v.composer=e,v.draftValue=Ot(e)),P())}async function Wn(){S&&await Qe(S,"manual",void 0,{preferSnapshot:!1})}async function V(e,t,n){if(!S||v.loading||!j())return null;v.loading=!0,v.activeCommand=e,v.lastError=null,v.lastResult=null,oe=null,D(g);try{const a=await U("run_cli_command",{command:e,args:t,targetRoot:S,expectJson:n.expectJson});return v.lastResult=a,v.lastError=a.ok?null:qn(a),a.ok?(v.composer=null,v.draftValue="",await Wn()):D(g),a}catch(a){const i=a instanceof Error?a.message:String(a);return await gi(e,t)?v.lastError=`Opened Terminal to run ${e} because desktop subprocess execution failed: ${i}`:v.lastError=i,D(g),null}finally{v.loading=!1,v.activeCommand=null,D(g)}}async function pn(e,t){if(!S||v.loading||!j())return null;v.loading=!0,v.activeCommand="status",v.lastError=null,v.lastResult=null,oe=null,D(g);try{const a=await U("run_cli_command",{command:"pack",args:e==="set"&&t?[e,t,"--json"]:[e,"--json"],targetRoot:S,expectJson:!0});return v.lastResult=a,v.lastError=a.ok?null:qn(a),a.ok?await Wn():D(g),a}catch(n){return v.lastError=n instanceof Error?n.message:String(n),D(g),null}finally{v.loading=!1,v.activeCommand=null,D(g)}}async function gi(e,t){if(!S||!j())return!1;try{return await U("open_terminal_command",{command:e,args:t,targetRoot:S}),!0}catch{return!1}}async function St(e){if(!(!S||!j()))try{await U("open_path",{targetRoot:S,path:e})}catch(t){v.lastError=t instanceof Error?t.message:String(t),D(g)}}function qn(e){const t=e.jsonPayload;if(t&&typeof t=="object"&&!Array.isArray(t)){const n=t,a=typeof n.failureReason=="string"?n.failureReason.trim():"",i=typeof n.validation=="string"?n.validation.trim():"",s=typeof n.detail=="string"?n.detail.trim():"",r=typeof n.nextCommand=="string"?n.nextCommand.trim():typeof n.nextSuggestedCommand=="string"?n.nextSuggestedCommand.trim():"",c=a||i||s;if(c)return r?`${c} Next: ${be(r,S)}`:c}return e.stderr||e.stdout||`${e.commandLabel} failed`}function gt(e){Nt={at:Date.now(),detail:e},nt!=null&&window.clearTimeout(nt),nt=window.setTimeout(()=>{nt=null,Me()},Pn+32)}function Oe(){Mt=Date.now()}function Yn(){return M==="graph"&&Date.now()-Mt<An}function Me(){if(!Yn()){Ve=!1,Ne!=null&&(window.clearTimeout(Ne),Ne=null),P();return}if(Ve=!0,Ne!=null)return;const e=Math.max(0,An-(Date.now()-Mt));Ne=window.setTimeout(()=>{Ne=null,Ve&&(Ve=!1,P())},e+16)}function ki(){return Re!=null&&Re.isConnected||(Re=se.querySelector("[data-graph-viewport]")),Re}function hn(){if(M!=="graph")return!1;const e=ki();return e?(e.setAttribute("transform",`translate(${ge.x} ${ge.y}) scale(${me})`),!0):!1}function mn(e){ct.add(e),!(rt||ze||ot)&&(rt=!0,window.requestAnimationFrame(()=>{rt=!1;const t=[...ct];ct.clear(),vi(t)||At()}))}function vi(e){if(M!=="graph"||e.length===0)return!1;const t=Je??Jn(g);if(!t)return!1;const n=se.querySelector("[data-graph-canvas-root]");if(!n)return!1;for(const a of e){const i=`[data-graph-node-wrap][data-path="${Ke(a)}"]`,s=n.querySelector(i),r=bt(t,fe,a);s&&r&&s.setAttribute("transform",`translate(${r.x}, ${r.y})`);const c=[`[data-graph-edge][data-from-path="${Ke(a)}"]`,`[data-graph-edge][data-to-path="${Ke(a)}"]`].join(",");for(const u of n.querySelectorAll(c)){const d=u.dataset.fromPath,y=u.dataset.toPath;if(!d||!y)continue;const o=bt(t,fe,d),$=bt(t,fe,y);!o||!$||(u.setAttribute("x1",String(o.x)),u.setAttribute("y1",String(o.y)),u.setAttribute("x2",String($.x)),u.setAttribute("y2",String($.y)))}}return!0}function Ke(e){return typeof CSS<"u"&&typeof CSS.escape=="function"?CSS.escape(e):e.replace(/["\\]/g,"\\$&")}function ht(e){const t=bi(e);if(t.length<2)return null;const n=t[0]??"";if(!["kiwi-control","kc","shrey-junior","sj"].includes(n))return null;const[a="",...i]=t.slice(1);if(a==="run"&&i[0]==="--auto"){const s=i.find((r,c)=>c>0&&r!=="--target"&&r!==S);return s?{command:"run-auto",args:[s]}:null}if(a==="handoff"){const s=i.findIndex(c=>c==="--to"),r=s>=0?i[s+1]:void 0;if(r)return{command:"handoff",args:[r]}}if(a==="checkpoint"){const s=i.find(r=>!r.startsWith("--"));return s?{command:"checkpoint",args:[s]}:null}if(a==="validate"){const s=i.find(r=>!r.startsWith("--")&&r!==S);return{command:"validate",args:s?[s]:[]}}if(a==="review"){const s=[],r=i.findIndex(u=>u==="--base"),c=r>=0?i[r+1]:void 0;return c&&!c.startsWith("--")&&s.push("--base",c),i.includes("--json")&&s.push("--json"),{command:"review",args:s}}return a==="init"?{command:"init",args:[]}:a==="sync"?{command:"sync",args:i.filter(r=>r==="--dry-run"||r==="--diff-summary"||r==="--backup")}:["guide","next","retry","resume","status","trace"].includes(a)?{command:a,args:i.includes("--json")?["--json"]:[]}:null}function bi(e){return[...e.matchAll(/"([^"]*)"|'([^']*)'|`([^`]*)`|([^\s]+)/g)].map(n=>n[1]??n[2]??n[3]??n[4]??"").filter(Boolean)}async function $i(e){const t=ht(e.command);if(t){await V(t.command,t.args,{expectJson:t.args.includes("--json")});return}if(e.retryCommand){const n=ht(e.retryCommand);if(n){await V(n.command,n.args,{expectJson:n.args.includes("--json")});return}}if(e.id==="execute"){await V("run-auto",[Ot("run-auto")],{expectJson:!1});return}if(e.id.includes("validate")){await V("validate",[],{expectJson:!0});return}await V("next",["--json"],{expectJson:!0})}function Xe(e){const t=(e.kiwiControl??_).executionPlan,n=new Map(t.steps.map(a=>[a.id,a]));return Z.map(a=>n.get(a)).filter(a=>!!a).map(a=>{var s,r;const i=Ee.get(a.id);return{...a,displayTitle:((s=i==null?void 0:i.label)==null?void 0:s.trim())||a.description,displayNote:((r=i==null?void 0:i.note)==null?void 0:r.trim())||a.result.summary||a.expectedOutput||null,skipped:ke.has(a.id)}})}function fn(e,t){const n=Z.indexOf(e),a=n+t;if(n<0||a<0||a>=Z.length)return;const i=[...Z],s=i[n],r=i[a];!s||!r||(i[n]=r,i[a]=s,Z=i,P())}function yi(e){ke.has(e)?ke.delete(e):ke.add(e),P()}function wi(e,t){_e=e,ye=t,P()}function xi(e){const t=Ee.get(e)??{label:"",note:""};Ee.set(e,{...t,label:ye.trim()||t.label}),_e=null,ye="",P()}function Jn(e){var r;const t=Ze(e),n=e.targetRoot||"repo",a=Ie??((L==null?void 0:L.kind)==="path"?L.path:null),i=((r=e.kiwiControl)==null?void 0:r.fileAnalysis.selected)??[];if(ee&&ee.baseTree===t&&ee.overrideVersion===ce&&ee.targetRoot===n&&ee.graphDepth===ie&&ee.focusPath===a&&ee.selectedAnalysis===i)return Je=ee.projection,ee.projection;const s=Oa({tree:t,rootPath:n,rootLabel:Gt(n)||"repo",graphDepth:ie,focusPath:a,selectedAnalysis:i});return ee={baseTree:t,overrideVersion:ce,targetRoot:n,graphDepth:ie,focusPath:a,selectedAnalysis:i,projection:s},Je=s,s}function Si(e){return Va(Jn(e),fe)}function We(e){const t=e.split(/[\\/]/).filter(Boolean);return t[t.length-1]??e}function gn(e){const t=e.tone==="ready"?"success":e.tone==="degraded"?"warn":e.tone==="blocked"?"blocked":"neutral",n=M==="overview"&&(e.tone==="blocked"||e.tone==="degraded")?"One repo-level issue needs attention. Use the next action below.":e.detail;return`
    <div class="kc-view-shell">
      <section class="kc-panel kc-command-banner tone-${t}">
        <div class="kc-command-banner-head">
          <div>
            <p class="kc-section-micro">${h(e.phase.replaceAll("_"," "))}</p>
            <strong>${h(e.label)}</strong>
          </div>
          <span class="kc-load-badge"><span class="kc-load-dot"></span>${h(e.phase.replaceAll("_"," "))}</span>
        </div>
        <p>${h(n)}</p>
        ${e.nextCommand?`<div class="kc-command-banner-actions"><code class="kc-command-chip">${h(be(e.nextCommand,S))}</code></div>`:""}
        <div class="kc-load-progress"><span class="kc-load-progress-fill" style="width:${e.progress}%"></span></div>
      </section>
    </div>
  `}function kn(e,t){const n=e.tone==="blocked"?"blocked":"warn",a=M==="overview"?"A recovery path is active. Use the repo-scoped command below.":e.detail;return`
    <div class="kc-view-shell">
      <section class="kc-panel kc-command-banner tone-${n}">
        <div class="kc-command-banner-head">
          <div>
            <p class="kc-section-micro">${h(t.kicker)}</p>
            <strong>${h(e.title)}</strong>
          </div>
          <span class="kc-load-badge"><span class="kc-load-dot"></span>${h(e.tone)}</span>
        </div>
        <p>${h(a)}</p>
        <div class="kc-command-banner-actions">
          ${e.nextCommand?`<code class="kc-command-chip">${h(be(e.nextCommand,S))}</code>`:""}
          ${e.followUpCommand?`<code class="kc-command-chip">${h(be(e.followUpCommand,S))}</code>`:""}
          ${t.actionLabel?`<button class="kc-secondary-button" type="button" data-reload-state>${h(t.actionLabel)}</button>`:""}
        </div>
      </section>
    </div>
  `}function Ci(){var s,r,c,u;const e=Ut(g),t=Bt(g);if(oe)return kn(oe,{kicker:"Action blocked"});if(v.loading||ae)return gn(e);if(t&&(t.tone==="blocked"||t.tone==="failed"||t.tone==="degraded")&&(e.visible||t.tone!=="blocked"||g.repoState.mode==="repo-not-initialized"||g.repoState.mode==="initialized-invalid"))return kn(t,{kicker:t.tone==="blocked"?"Workflow blocked":t.tone==="degraded"?"Using cached snapshot":"Load failed",actionLabel:t.actionLabel??null});if(e.visible)return gn(e);if(!v.lastResult&&!v.lastError)return"";const n=v.lastError?"warn":(s=v.lastResult)!=null&&s.ok?"success":"warn",a=v.lastError?"Last command failed":(r=v.lastResult)!=null&&r.ok?"Last command completed":"Last command reported an issue",i=v.lastError??((c=v.lastResult)==null?void 0:c.stderr)??((u=v.lastResult)==null?void 0:u.stdout)??"No command detail was recorded.";return`
    <div class="kc-view-shell">
      <section class="kc-panel kc-command-banner tone-${n}">
        <div class="kc-command-banner-head">
          <div>
            <p class="kc-section-micro">Command Result</p>
            <strong>${h(a)}</strong>
          </div>
          ${v.lastResult?`<code class="kc-command-chip">${h(v.lastResult.commandLabel)}</code>`:""}
        </div>
        <p>${h(i)}</p>
      </section>
    </div>
  `}function Ri(e,t){var $,b;const n=t.closest("[data-onboarding-action]");if(n!=null&&n.dataset.onboardingAction){const p=n.dataset.onboardingAction;return p==="install-cli"?ei():p==="choose-repo"?ti():p==="init-repo"&&S&&V("init",[],{expectJson:!1}),!0}const a=t.closest("[data-ui-command]");if(a!=null&&a.dataset.uiCommand){const p=a.dataset.uiCommand;if(p==="run-auto"||p==="checkpoint"||p==="handoff")un(p);else if(p==="retry"){const m=((b=($=g.kiwiControl)==null?void 0:$.executionPlan.lastError)==null?void 0:b.retryCommand)??"",f=m?ht(m):null;f?V(f.command,f.args,{expectJson:f.args.includes("--json")}):V("retry",[],{expectJson:!1})}else V(p,vn(p)?["--json"]:[],{expectJson:vn(p)});return!0}const i=t.closest("[data-pack-action]");if(i!=null&&i.dataset.packAction){const p=i.dataset.packAction;if(p==="clear")return pn("clear"),!0;if(p==="set"&&i.dataset.packId)return pn("set",i.dataset.packId),!0}const s=t.closest("[data-composer-submit]");if(s!=null&&s.dataset.composerSubmit){const p=s.dataset.composerSubmit,m=v.draftValue.trim(),f=Kn(g,p,m);return f.blocked?(oe=ra(p,f.reason,f.nextCommand),v.lastError=null,P(),!0):m?(V(p==="run-auto"?"run-auto":p==="checkpoint"?"checkpoint":"handoff",[m],{expectJson:!1}),!0):(v.lastError=`${p} requires a value before running.`,oe=null,P(),!0)}if(t.closest("[data-composer-cancel]"))return v.composer=null,v.draftValue="",oe=null,P(),!0;const r=t.closest("[data-tree-action]");if(r!=null&&r.dataset.treeAction&&r.dataset.path){e.preventDefault(),e.stopPropagation();const p=r.dataset.path,m=r.dataset.treeAction;return m==="open"?St(p):m==="focus"?(L={kind:"path",id:p,label:We(p),path:p},Ie=p,P()):xt(p,m),!0}const c=t.closest("[data-tree-bulk]");if(c!=null&&c.dataset.treeBulk){const p=Ze(g),m=_t(p.nodes).map(f=>f.path);if(c.dataset.treeBulk==="reset")mi();else if(c.dataset.treeBulk==="undo")fi();else{jt();for(const f of m)de.set(f,c.dataset.treeBulk);ce+=1,G=null,P()}return!0}const u=t.closest("[data-graph-node]");if(u!=null&&u.dataset.path){const p=u.dataset.path;return L={kind:"path",id:p,label:We(p),path:p},Ie=p,e.detail>1&&u.dataset.kind==="file"&&St(p),P(),!0}const d=t.closest("[data-graph-action]");if(d!=null&&d.dataset.graphAction){const p=d.dataset.path,m=d.dataset.graphAction;if(m==="depth-up")ie=Math.min(3,ie+1);else if(m==="depth-down")ie=Math.max(1,ie-1);else if(m==="reset-view")ge={x:0,y:0},me=1,fe.clear();else if(p)if(m==="open")St(p);else return m==="focus"?(L={kind:"path",id:p,label:We(p),path:p},Ie=p,P(),!0):(xt(p,m),!0);return P(),!0}const y=t.closest("[data-plan-action]");if(y!=null&&y.dataset.planAction&&y.dataset.stepId){const p=y.dataset.stepId,m=Xe(g).find(f=>f.id===p);if(!m)return!0;switch(y.dataset.planAction){case"run":$i(m);break;case"retry":if(m.retryCommand){const f=ht(m.retryCommand);f?V(f.command,f.args,{expectJson:f.args.includes("--json")}):V("retry",[],{expectJson:!1})}else V("retry",[],{expectJson:!1});break;case"skip":yi(p);break;case"edit":wi(p,m.displayTitle);break;case"edit-save":xi(p);break;case"edit-cancel":_e=null,ye="",P();break;case"move-up":fn(p,-1);break;case"move-down":fn(p,1);break;case"focus":L={kind:"step",id:m.id,label:m.displayTitle},P();break}return!0}const o=t.closest("[data-inspector-action]");if(o!=null&&o.dataset.inspectorAction){const p=o.dataset.inspectorAction;if(p==="approve"||p==="reject"){const m=L==null?void 0:L.id;return m&&Ft.set(m,p==="approve"?"approved":"rejected"),P(),!0}if(p==="add-to-context"&&(L==null?void 0:L.kind)==="path")return xt(L.path,"include"),!0;if(p==="validate")return V("validate",[],{expectJson:!0}),!0;if(p==="handoff")return un("handoff"),!0}return!1}function vn(e){return["guide","next","validate","status","trace"].includes(e)}function Xn(e){if(!e)return null;const t=e.trim().toLowerCase();return Tn.some(n=>n.id===t)?t:null}function Vt(e){var o,$,b,p;if(!j())return;const t=!!(nn&&!nn.classList.contains("is-hidden")),n=Ut(e),a=[...document.querySelectorAll("[data-render-section]")].map(m=>m.dataset.renderSection??"").filter(m=>m.length>0),i=[...document.querySelectorAll("[data-ui-command]")].map(m=>m.dataset.uiCommand??"").filter(m=>m.length>0),s=[...document.querySelectorAll('[data-pack-action="set"][data-pack-id]')].map(m=>m.dataset.packId??"").filter(m=>m.length>0),r=document.querySelectorAll(".kc-log-body .kc-log-line").length,c=(o=e.kiwiControl)==null?void 0:o.executionPlan,u=e.runtimeDecision.currentStepId??(($=c==null?void 0:c.steps[c.currentStepIndex])==null?void 0:$.id)??((b=e.kiwiControl)==null?void 0:b.workflow.currentStepId)??null,d={mounted:!!((p=window.__KIWI_BOOT_API__)!=null&&p.mounted),bootVisible:t,activeView:M,targetRoot:e.targetRoot,selectedPack:e.mcpPacks.selectedPack.id,selectedPackSource:e.mcpPacks.selectedPackSource,selectablePackIds:s,packCatalog:e.mcpPacks.available.map(m=>({id:m.id,executable:m.executable,unavailablePackReason:m.unavailablePackReason})),repoMode:e.repoState.mode,executionState:e.executionState.lifecycle,executionRevision:e.executionState.revision,mainScrollTop:Math.round((se==null?void 0:se.scrollTop)??0),historyLineCount:r,currentStep:u,loadPhase:n.phase,loadLabel:n.label,loadDetail:n.detail,visibleSections:a,visibleCommands:i},y=JSON.stringify(d);y!==on&&(on=y,U("write_render_probe",{payload:d}).catch(()=>{}))}async function Ti(){if(!(!j()||$t)){$t=!0;try{const e=await U("consume_render_action");if(!e)return;if(e.actionType==="click-pack"&&e.packId){const t=document.querySelector(`[data-pack-action="set"][data-pack-id="${Ke(e.packId)}"]`);if(t){t.click();return}const n=document.querySelector(`[data-pack-card="true"][data-pack-id="${Ke(e.packId)}"] summary`);n==null||n.click();return}if(e.actionType==="clear-pack"){const t=document.querySelector('[data-pack-action="clear"]');t==null||t.click();return}if(e.actionType==="switch-view"&&e.view){const t=Xn(e.view);t&&t!==M&&(M=t,pt=!0),P(),Dt(M,!1);return}e.actionType==="set-main-scroll"&&typeof e.y=="number"&&(se.scrollTop=e.y,Vt(g))}catch{}finally{$t=!1}}}function D(e){var t;g=e,ui(e),In.innerHTML=Pi(),It.innerHTML=Ai(e),Qn(e),dt.innerHTML=Xi(e),Tt.innerHTML=Zi(e),Pt.classList.toggle("is-inspector-open",Ye),Pt.classList.toggle("is-log-open",De),dt.classList.toggle("is-hidden",!Ye),Tt.classList.toggle("is-hidden",!De),pt&&(se.scrollTop=0,pt=!1),(t=window.__KIWI_BOOT_API__)!=null&&t.mounted||Nn(),Vt(e)}function Qn(e){se.innerHTML=`${Ci()}${Mi(e)}`,Re=null,M!=="graph"&&(Je=null)}function P(){ze||(ze=!0,window.requestAnimationFrame(()=>{ze=!1,D(g)}))}function At(){ot||ze||(ot=!0,window.requestAnimationFrame(()=>{ot=!1,Qn(g)}))}function Pi(){return Tn.map(e=>`
    <button class="kc-rail-button ${e.id===M?"is-active":""}" data-view="${e.id}" type="button">
      <span class="kc-rail-icon">${e.icon}</span>
      <span class="kc-rail-label">${h(e.label)}</span>
    </button>
  `).join("")}function Ai(e){var y,o,$,b;const t=Ii(e),n=Gt(e.targetRoot),a=ve(e.repoOverview,"Current phase"),i=ve(e.repoOverview,"Validation state"),s=Le==="dark"?"Light mode":"Dark mode",r=((y=e.kiwiControl)==null?void 0:y.contextView.task)??(($=(o=e.kiwiControl)==null?void 0:o.nextActions.actions[0])==null?void 0:$.action)??"",c=!!((b=e.runtimeDecision.recovery)!=null&&b.retryCommand)||!!S,u=v.composer?Kn(e,v.composer,v.draftValue):null,d=te?{label:"App",detail:`${us(te.buildSource)} · v${te.appVersion}${te.runtimeIdentity?` · runtime ${te.runtimeIdentity.packagingSourceCategory} (${te.runtimeIdentity.callerSurface})`:""}`}:null;return ma({state:e,decision:t,repoLabel:n,phase:a,validationState:i,themeLabel:s,activeTheme:Le,activeMode:$e,isLogDrawerOpen:De,isInspectorOpen:Ye,currentTargetRoot:S,commandState:v,currentTask:r,retryEnabled:c,composerConstraint:u,runtimeInfo:d,loadStatus:Ut(e),helpers:et()})}function Li(){const e=pe.size;return e===0?"Refreshing machine-local diagnostics in the background.":`Refreshing ${[...pe].map(n=>{switch(n){case"mcpInventory":return"MCP inventory";case"optimizationLayers":return"optimization layers";case"setupPhases":return"setup phases";case"configHealth":return"config health";default:return n}}).join(", ")}${e>1?" in the background":""}.`}function Bt(e){return oa(e,{lastRepoLoadFailure:Q})}function zt(e){return{commandState:{loading:v.loading,activeCommand:v.activeCommand},currentLoadSource:st,currentTargetRoot:S,isLoadingRepoState:ae,isRefreshingFreshRepoState:le,lastRepoLoadFailure:Q,lastReadyStateSignal:Nt,readyStatePulseMs:Pn,machineHydrationInFlight:Be,machineHydrationDetail:Li(),activeTargetHint:Ha(e),recoveryGuidance:Bt(e),isMachineHeavyViewActive:_n(M),machineAdvisoryStale:e.machineAdvisory.stale}}function Ut(e){return Rn(e,zt(e))}function Ii(e){return $a(e,{isLoadingRepoState:ae,isRefreshingFreshRepoState:le,hasWarmSnapshot:e.loadState.source==="warm-snapshot"||e.loadState.source==="stale-snapshot",formatTimestamp:re})}function Ei(e,t){return`
    <div class="kc-inline-meta">
      <span>${h(e)}</span>
      <strong>${h(t)}</strong>
    </div>
  `}function et(){return{escapeHtml:h,escapeAttribute:Yt,iconSvg:F,iconLabel:ta,formatCliCommand:be,renderHeaderBadge:q,renderHeaderMeta:Ei,renderPanelHeader:w,renderInlineBadge:z,renderNoteRow:R,renderEmptyState:T,renderStatCard:A,renderInfoRow:C,renderListBadges:qe,renderExplainabilityBadge:lt,renderGateRow:Zn,renderBulletRow:we,deriveSignalImpact:ts,formatInteger:na,formatPercent:ls,formatCurrency:ds,formatTimestamp:re,formatTokensShort:B}}function Mi(e){switch(M){case"context":return Hi(e);case"graph":return Di(e);case"tokens":return Oi(e);case"feedback":return Ji(e);case"mcps":return Vi(e);case"specialists":return Wi(e);case"system":return qi(e);case"validation":return _i(e);case"machine":return Yi(e);case"overview":default:return Fi(e)}}function Ni(e){return Fa(e,zt(e))}function Fi(e){var b,p;const t=e.kiwiControl??_,n=Ze(e),a=Ni(e),i=Bt(e),s=t.nextActions.actions[0]??null,r=be(s==null?void 0:s.command,e.targetRoot),c=ve(e.continuity,"Current focus"),u=((b=e.specialists.activeProfile)==null?void 0:b.name)??e.specialists.activeSpecialist,d=t.contextView.task??"No prepared task",y=Ia(t.fileAnalysis.selected),o=Ea({targetRoot:e.targetRoot,recoveryGuidance:i,executionPlan:t.executionPlan}),$=Ra({runtimeInfo:te,targetRoot:e.targetRoot,repoMode:e.repoState.mode});return`
    <div class="kc-view-shell">
      <section class="kc-panel kc-panel-primary">
        <div class="kc-panel-heading">
          <div class="kc-panel-kicker">
            ${ta(F("overview"),"Next Action")}
            ${s?q(s.priority,s.priority):q("stable","neutral")}
          </div>
          <h1>${h((s==null?void 0:s.action)??e.repoState.title)}</h1>
          <p>${h((s==null?void 0:s.reason)??(t.nextActions.summary||e.repoState.detail))}</p>
        </div>
        <div class="kc-primary-footer">
          ${r?`<code class="kc-command-chip">${h(r)}</code>`:""}
          <span>${h(c)}</span>
        </div>
      </section>

      ${$?Ta($,et()):""}

      <div class="kc-stat-grid">
        ${A("Repo State",e.repoState.title,e.validation.ok?"ready to use":`${e.validation.errors+e.validation.warnings} issues`,e.validation.ok?"success":"warn")}
        ${A("Task",d,t.contextView.confidenceDetail??"current working set","neutral")}
        ${A("Selected Files",String(n.selectedCount),"current bounded context","neutral")}
        ${A("Lifecycle",e.executionState.lifecycle,a.detail,e.executionState.lifecycle==="blocked"||e.executionState.lifecycle==="failed"?"warn":"neutral")}
      </div>

      ${o.length>0?`
          <section class="kc-panel" data-render-section="blocked-workflow-fix">
            ${w("How To Unblock","Follow the recovery steps below.")}
            <div class="kc-stack-list">
              ${o.map((m,f)=>R(`${f+1}. ${m.title}`,m.command,m.detail)).join("")}
            </div>
          </section>
        `:""}

      <div class="kc-two-column">
        <section class="kc-panel">
          ${w("Repo State","Current repo truth and routing for this session.")}
          <div class="kc-info-grid">
            ${C("Project type",e.projectType)}
            ${C("Execution mode",e.executionMode)}
            ${C("Active specialist",u)}
            ${C("Selected pack",e.mcpPacks.selectedPack.name??e.mcpPacks.selectedPack.id)}
            ${C("Next action",r||"No repo-scoped next command is recorded.")}
          </div>
        </section>
        <section class="kc-panel">
          ${w("Task Summary","The current working set and why it matters.")}
          <div class="kc-keyline-value">
            <strong>${h(d)}</strong>
            <span>${h((t.indexing.selectionReason??t.contextView.reason??t.nextActions.summary)||e.repoState.detail)}</span>
          </div>
          <div class="kc-stack-list">
            ${R("Current focus","repo-local",c)}
            ${R("Review pack",t.repoIntelligence.reviewPackAvailable?t.repoIntelligence.reviewPackPath??"ready":"not generated",t.repoIntelligence.reviewPackSummary??"Run kc review to write the compact local review workflow for the current diff.")}
          </div>
        </section>
      </div>

      <section class="kc-panel" data-render-section="explain-selection">
        ${w("Explain This Selection","Why the most important files are in the current working set.")}
        ${y.length>0?`<div class="kc-stack-list">${y.slice(0,6).map(m=>R(m.title,m.metric,m.note)).join("")}</div>`:T("No selected-file reasoning is available yet. Run kc prepare to build a bounded working set first.")}
      </section>

      ${Qi(e)}

      <section class="kc-panel">
        <div class="kc-panel-head-row">
          ${w("Context Tree","What Kiwi selected, considered, and ignored from the live selector state.")}
          ${q(((p=t.contextView.confidence)==null?void 0:p.toUpperCase())??"UNKNOWN",t.contextView.confidence==="high"?"success":t.contextView.confidence==="low"?"warn":"neutral")}
        </div>
        ${n.nodes.length>0?ea(n):T('Run kc prepare "your task" to build a repo-local context tree.')}
      </section>
    </div>
  `}function Hi(e){var u;const t=e.kiwiControl??_,n=t.contextView,a=t.indexing,i=Ze(e),s=Bn(e),r=i.nodes.slice(0,8),c=zi(e);return`
    <div class="kc-view-shell">
      <section class="kc-view-header">
        <div>
          <p class="kc-view-kicker">Context Selection</p>
          <h1>${h(n.task??"No prepared task")}</h1>
          <p>${h(n.confidenceDetail??"Kiwi Control only shows files the selector actually considered.")}</p>
        </div>
        <div class="kc-header-metrics">
          ${Ct(String(n.tree.selectedCount),"selected")}
          ${Ct(String(n.tree.candidateCount),"candidate")}
          ${Ct(String(n.tree.excludedCount),"excluded")}
        </div>
      </section>

      <div class="kc-context-grid">
        <section class="kc-panel">
          <div class="kc-panel-head-row">
            ${w("Repo Tree","Selected, candidate, and excluded files grounded in live selector state.")}
            <div class="kc-inline-badges">
              <button class="kc-secondary-button" type="button" data-tree-bulk="include">Include visible</button>
              <button class="kc-secondary-button" type="button" data-tree-bulk="exclude">Exclude visible</button>
              <button class="kc-secondary-button" type="button" data-tree-bulk="reset">Reset local edits</button>
              <button class="kc-secondary-button" type="button" data-tree-bulk="undo">Undo</button>
              <button class="kc-secondary-button" type="button" data-reload-state>${F("refresh")}Refresh</button>
            </div>
          </div>
          <p class="kc-support-copy">Local include, exclude, and ignore edits stay in this desktop session until a CLI or runtime write commits them.</p>
          ${i.nodes.length>0?ea(i):T('Run kc prepare "your task" to build the repo tree from live selection signals.')}
        </section>

        <section class="kc-panel">
          ${w("Navigation Map","Use this as a high-density orientation strip before drilling into the full tree.")}
          ${r.length>0?`<div class="kc-inline-badges">${r.map(d=>z(`${d.name}:${d.status}`)).join("")}</div>`:T("No top-level repo map is available yet.")}
          <div class="kc-divider"></div>
          ${w("Selection State",n.reason??"No selection reason recorded.")}
          <div class="kc-info-grid">
            ${C("Confidence",((u=n.confidence)==null?void 0:u.toUpperCase())??"UNKNOWN")}
            ${C("Scope area",a.scopeArea??"unknown")}
            ${C("Selected files",String(s.length))}
            ${C("Observed files",String(a.observedFiles))}
            ${C("Indexed files",String(a.indexedFiles))}
            ${C("Impact files",String(a.impactFiles))}
            ${C("Keyword matches",String(a.keywordSignals))}
            ${C("Import neighbors",String(a.importSignals))}
            ${C("Discovery depth",String(a.maxDepthExplored))}
          </div>
          <div class="kc-divider"></div>
          <div class="kc-stack-block">
            <p class="kc-stack-label">Coverage</p>
            <p class="kc-support-copy">${h(a.coverageNote)}</p>
            <div class="kc-inline-badges">
              ${z(`visited ${a.visitedDirectories} dirs`)}
              ${z(a.fileBudgetReached?"file budget hit":"file budget clear")}
              ${z(a.directoryBudgetReached?"dir budget hit":"dir budget clear")}
            </div>
          </div>
          <div class="kc-divider"></div>
          <div class="kc-stack-block">
            <p class="kc-stack-label">Selected files</p>
            ${s.length>0?qe(s):T("No active files are selected yet.")}
          </div>
        </section>
      </div>

      <section class="kc-panel">
        ${w("How Kiwi Indexed This Repo","These are the actual scan and signal mechanics behind the current tree, not generic advice.")}
        <div class="kc-stack-list">
          ${c.map(d=>R(d.title,d.metric,d.note)).join("")}
        </div>
      </section>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${w("FILE ANALYSIS PANEL","Measured scan counts plus why files were selected, excluded, or skipped.")}
          <div class="kc-info-grid">
            ${C("Total files",String(t.fileAnalysis.totalFiles))}
            ${C("Scanned files",String(t.fileAnalysis.scannedFiles))}
            ${C("Skipped files",String(t.fileAnalysis.skippedFiles))}
            ${C("Selected files",String(t.fileAnalysis.selectedFiles))}
            ${C("Excluded files",String(t.fileAnalysis.excludedFiles))}
          </div>
          <div class="kc-divider"></div>
          <div class="kc-stack-list">
            ${t.fileAnalysis.selected.slice(0,3).map(d=>R(d.file,"selected",d.selectionWhy??d.reasons.join(", "))).join("")}
            ${t.fileAnalysis.excluded.slice(0,3).map(d=>R(d.file,"excluded",d.note??d.reasons.join(", "))).join("")}
            ${t.fileAnalysis.skipped.slice(0,3).map(d=>R(d.path,"skipped",d.reason)).join("")}
          </div>
        </section>
        <section class="kc-panel">
          ${w("CONTEXT TRACE","Initial signals, expansion steps, and final bounded selection.")}
          ${t.contextTrace.expansionSteps.length>0?`<div class="kc-fold-grid">${t.contextTrace.expansionSteps.map(d=>`
                <details class="kc-fold-card" open>
                  <summary>
                    <div>
                      <strong>${h(d.step)}</strong>
                      <span>${h(d.summary)}</span>
                    </div>
                    ${q(`${d.filesAdded.length} files`,"neutral")}
                  </summary>
                  <div class="kc-fold-body">
                    ${d.filesAdded.length>0?qe(d.filesAdded.slice(0,8)):T("No files recorded for this step.")}
                    ${d.filesRemoved&&d.filesRemoved.length>0?`<div class="kc-divider"></div>${qe(d.filesRemoved.slice(0,8))}`:""}
                  </div>
                </details>
              `).join("")}</div>`:T("Run kc prepare to record a trace of how Kiwi built the working set.")}
        </section>
      </div>

      <section class="kc-panel">
        ${w("Dependency Chains","Shortest structural paths that pulled files into the working set.")}
        ${t.fileAnalysis.selected.some(d=>Array.isArray(d.dependencyChain)&&d.dependencyChain.length>1)?`<div class="kc-stack-list">${t.fileAnalysis.selected.filter(d=>Array.isArray(d.dependencyChain)&&d.dependencyChain.length>1).slice(0,6).map(d=>R(d.file,"chain",(d.dependencyChain??[]).join(" -> "))).join("")}</div>`:T("No structural dependency chain was needed for the current selection.")}
      </section>

      <section class="kc-panel">
        ${w("INDEXING","How the repo scan progressed, where it stopped, and which ignore rules were applied.")}
        <div class="kc-info-grid">
          ${C("Directories visited",String(a.visitedDirectories))}
          ${C("Skipped directories",String(a.skippedDirectories))}
          ${C("Depth reached",String(a.maxDepthExplored))}
          ${C("Files discovered",String(a.discoveredFiles))}
          ${C("Files analyzed",String(a.analyzedFiles))}
          ${C("Index reused",String(a.indexReusedFiles))}
          ${C("Index refreshed",String(a.indexUpdatedFiles))}
          ${C("Ignore rules",String(a.ignoreRulesApplied.length))}
        </div>
        <div class="kc-divider"></div>
        <div class="kc-inline-badges">
          ${lt("heuristic",t.contextTrace.honesty.heuristic)}
          ${lt("low confidence",t.contextTrace.honesty.lowConfidence)}
          ${lt("partial scan",t.contextTrace.honesty.partialScan||a.partialScan)}
        </div>
        <div class="kc-divider"></div>
        <div class="kc-stack-list">
          ${a.ignoreRulesApplied.slice(0,4).map(d=>we(d)).join("")}
        </div>
      </section>
    </div>
  `}function Di(e){const t=Si(e),n=t.nodes.find(a=>a.path===(Ie??((L==null?void 0:L.kind)==="path"?L.path:null)))??null;return fa({state:e,graph:t,focusedNode:n,graphDepth:ie,graphPan:ge,graphZoom:me,graphMechanics:Ui(e,t),treeMechanics:Gi(e),helpers:et()})}function _i(e){const t=e.validation.issues??[],n=t.filter(i=>i.level==="warn"),a=t.filter(i=>i.level==="error");return`
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
        ${A("Passing",e.validation.ok?"yes":"no","repo contract",e.validation.ok?"success":"warn")}
        ${A("Errors",String(e.validation.errors),"blocking",e.validation.errors>0?"critical":"neutral")}
        ${A("Warnings",String(e.validation.warnings),"non-blocking",e.validation.warnings>0?"warn":"neutral")}
        ${A("Memory",`${e.memoryBank.filter(i=>i.present).length}/${e.memoryBank.length}`,"surfaces present","neutral")}
      </div>

      <section class="kc-panel">
        <div class="kc-tab-row">
          ${Ae("all",He,"All")}
          ${Ae("issues",He,`Issues ${a.length+n.length>0?`(${a.length+n.length})`:""}`,"data-validation-tab")}
          ${Ae("pending",He,"Pending","data-validation-tab")}
        </div>
        ${ji(e)}
      </section>
    </div>
  `}function ji(e){const n=(e.validation.issues??[]).filter(a=>a.level==="error"||a.level==="warn");return He==="issues"?n.length>0?`<div class="kc-stack-list">${n.map(is).join("")}</div>`:T("No warnings or errors are currently recorded in repo-local validation."):He==="pending"?T("Kiwi Control does not infer pending checks beyond repo-local validation state."):`
    <div class="kc-two-column">
      <section class="kc-subpanel">
        ${w("Repo Contract",e.repoState.sourceOfTruthNote)}
        <div class="kc-info-grid">
          ${e.repoOverview.map(a=>C(a.label,a.value,a.tone==="warn"?"warn":"default")).join("")}
        </div>
      </section>
      <section class="kc-subpanel">
        ${w("Continuity","Latest checkpoint, handoff, reconcile, and open risk state.")}
        <div class="kc-info-grid">
          ${e.continuity.map(a=>C(a.label,a.value,a.tone==="warn"?"warn":"default")).join("")}
        </div>
      </section>
    </div>
  `}function Oi(e){const t=e.kiwiControl??_,n=t.tokenAnalytics;return`
    <div class="kc-view-shell">
      <section class="kc-view-header">
        <div>
          <p class="kc-view-kicker">Token Analytics</p>
          <h1>${h(n.task??"No token estimate yet")}</h1>
          <p>${h(n.estimateNote??'Run kc prepare "your task" to generate a repo-local rough estimate.')}</p>
        </div>
        ${q(n.estimationMethod??"not generated","neutral")}
      </section>

      <div class="kc-stat-grid">
        ${A("Selected",`~${B(n.selectedTokens)}`,"approximate","neutral")}
        ${A("Full Repo",`~${B(n.fullRepoTokens)}`,"approximate","neutral")}
        ${A("Saved",`~${n.savingsPercent}%`,"approximate","success")}
        ${A("Measured Files",`${n.fileCountSelected}/${n.fileCountTotal}`,"direct count","neutral")}
        ${A("Measured Usage",t.measuredUsage.available?B(t.measuredUsage.totalTokens):"unavailable",t.measuredUsage.available?`${t.measuredUsage.totalRuns} real runs`:"falling back to estimate",t.measuredUsage.available?"success":"warn")}
      </div>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${w("Measured Usage",t.measuredUsage.note)}
          ${t.measuredUsage.available?`<div class="kc-stack-list">
                ${R("Source",t.measuredUsage.source,t.measuredUsage.note)}
                ${t.measuredUsage.workflows.slice(0,4).map(a=>R(a.workflow,`${B(a.tokens)} tokens`,`${a.runs} runs`)).join("")}
              </div>`:T("No measured repo usage was found in local session or execution logs.")}
        </section>
        <section class="kc-panel">
          ${w("Estimated Usage",n.estimationMethod??"No estimate method recorded.")}
          <div class="kc-stack-list">
            ${R("Selected working set",`~${B(n.selectedTokens)}`,"Heuristic estimate for the current bounded context.")}
            ${R("Full repo",`~${B(n.fullRepoTokens)}`,"Heuristic estimate for all scanned repo files.")}
            ${R("Savings",`~${n.savingsPercent}%`,"Measured file counts with heuristic token estimation.")}
          </div>
        </section>
      </div>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${w("Top Directories","Measured directories with the largest share of estimated token usage.")}
          ${n.topDirectories.length>0?`<div class="kc-bar-list">${n.topDirectories.slice(0,6).map(a=>as(a.directory,a.tokens,n.fullRepoTokens,`${a.fileCount} files`)).join("")}</div>`:T("No directory analytics recorded yet.")}
        </section>
        <section class="kc-panel">
          ${w("Context Breakdown",n.estimationMethod??"No estimate method recorded.")}
          ${yn("Selected vs repo",n.selectedTokens,n.fullRepoTokens)}
          ${t.wastedFiles.files.length>0?yn("Wasted within selection",t.wastedFiles.totalWastedTokens,n.selectedTokens):""}
          <div class="kc-divider"></div>
          ${t.wastedFiles.files.length>0?`<div class="kc-stack-list">${t.wastedFiles.files.slice(0,4).map(a=>R(a.file,`${B(a.tokens)} tokens`,a.reason)).join("")}</div>`:T("No wasted files are recorded in the active selection.")}
        </section>
      </div>

      <section class="kc-panel">
        ${w("How To Reduce Tokens","Concrete actions that affect selection size, measured usage, and model tradeoffs.")}
        <div class="kc-stack-list">
          ${Bi(e).map(a=>R(a.title,a.metric,a.note)).join("")}
        </div>
      </section>

      <section class="kc-panel">
        ${w("Why These Token Numbers Look This Way","Token analytics here are driven by the indexed tree, selected working set, and measured local execution data when available.")}
        <div class="kc-stack-list">
          ${Ki(e).map(a=>R(a.title,a.metric,a.note)).join("")}
        </div>
      </section>

      <section class="kc-panel">
        ${w("Heavy Directories","Directories that dominate repo token volume.")}
        ${t.heavyDirectories.directories.length>0?`<div class="kc-stack-list">${t.heavyDirectories.directories.slice(0,4).map(a=>R(a.directory,`${a.percentOfRepo}% of repo`,a.suggestion)).join("")}</div>`:T("No heavy-directory warnings are recorded for this repo.")}
      </section>

      <section class="kc-panel">
        ${w("TOKEN BREAKDOWN","Where token reduction came from, and whether that reduction is measured or heuristic.")}
        ${t.tokenBreakdown.categories.length>0?`<div class="kc-stack-list">${t.tokenBreakdown.categories.map(a=>R(a.category,`${a.basis} · ~${B(a.estimated_tokens_avoided)}`,a.note)).join("")}</div>`:T("No token breakdown has been recorded yet.")}
      </section>

      <section class="kc-panel">
        ${w("Measured Files","Per-file measured usage is only shown when repo-local execution entries carry non-zero token totals.")}
        ${t.measuredUsage.files.length>0?`<div class="kc-stack-list">${t.measuredUsage.files.slice(0,6).map(a=>R(a.file,`${B(a.tokens)} tokens`,`${a.runs} runs · ${a.attribution}`)).join("")}</div>`:T("No measured per-file attribution is available yet.")}
      </section>
    </div>
  `}function Vi(e){const t=e.mcpPacks.compatibleCapabilities,n=t.filter(o=>o.trustLevel==="high").length,a=t.filter(o=>o.writeCapable).length,i=t.filter(o=>o.approvalRequired).length,s=e.mcpPacks.selectedPack,r=e.mcpPacks.suggestedPack,c=e.mcpPacks.explicitSelection!==null,d=e.mcpPacks.available.filter(o=>o.executable).filter(o=>o.id!==s.id),y=e.mcpPacks.available.filter(o=>!o.executable);return`
    <div class="kc-view-shell">
      <section class="kc-view-header">
        <div>
          <p class="kc-view-kicker">MCP / Tool Integrations</p>
          <h1>${h(s.name??s.id)}</h1>
          <p>${h(s.description)}</p>
        </div>
        ${q(e.mcpPacks.capabilityStatus,e.mcpPacks.capabilityStatus==="compatible"?"success":"warn")}
      </section>

      <div class="kc-stat-grid">
        ${A("Compatible MCPs",String(t.length),e.mcpPacks.selectedPackSource==="runtime-explicit"?"explicit pack policy":"heuristic pack policy",t.length>0?"success":"warn")}
        ${A("High Trust",String(n),"preferred first",n>0?"success":"neutral")}
        ${A("Write Capable",String(a),"requires judgment",a>0?"warn":"neutral")}
        ${A("Approval Gates",String(i),"use with care",i>0?"warn":"neutral")}
      </div>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${w("Selected Pack",e.mcpPacks.note)}
          <div class="kc-stack-list">
            ${C("Source",e.mcpPacks.selectedPackSource)}
            ${C("Heuristic default",r.name??r.id)}
            ${C("Executable",e.mcpPacks.executable?"yes":"no")}
          </div>
          ${e.mcpPacks.unavailablePackReason?`<div class="kc-divider"></div><div class="kc-stack-list">${R("Blocked","warn",e.mcpPacks.unavailablePackReason)}</div>`:""}
          <div class="kc-divider"></div>
          <div class="kc-stack-list">
            ${(s.guidance??[]).map(o=>we(o)).join("")}
          </div>
          <div class="kc-divider"></div>
          <div class="kc-stack-list">
            ${(s.realismNotes??[]).map(o=>R("Reality check","advisory",o)).join("")}
          </div>
          ${c?'<div class="kc-divider"></div><div class="kc-stack-list"><button class="kc-action-button secondary" data-pack-action="clear">Clear explicit pack</button></div>':""}
        </section>
        <section class="kc-panel">
          ${w("Compatible MCP Capabilities","These integrations are active for the selected pack, repo profile, and workflow role.")}
          ${t.length>0?`<div class="kc-stack-list">${t.map(o=>ns(o)).join("")}</div>`:T("No compatible MCP integrations are currently exposed for this workflow role and profile.")}
        </section>
      </div>

      <div class="kc-two-column">
        <section class="kc-panel" data-render-section="mcp-selectable-packs">
          ${w("Selectable Packs","Executable packs you can switch to in this repo.")}
          <div class="kc-fold-grid">
            ${d.length>0?d.map(o=>`
            <details class="kc-fold-card" data-pack-card="true" data-pack-id="${h(o.id)}">
              <summary>
                <div>
                  <strong>${h(o.name??o.id)}</strong>
                  <span>${h(o.description)}</span>
                </div>
                ${q("available","neutral")}
              </summary>
              <div class="kc-fold-body">
                <div class="kc-stack-list">
                  ${(o.guidance??[]).map($=>we($)).join("")}
                </div>
                <div class="kc-divider"></div>
                <div class="kc-stack-list">
                  ${C("Allowed",o.allowedCapabilityIds.join(", ")||"none")}
                  ${C("Preferred",o.preferredCapabilityIds.join(", ")||"none")}
                </div>
                <div class="kc-divider"></div>
                <div class="kc-stack-list">
                  <button class="kc-action-button" data-pack-action="set" data-pack-id="${h(o.id)}">Select pack</button>
                </div>
              </div>
            </details>
          `).join(""):T("No alternative executable packs are available in this repo.")}
          </div>
        </section>
        <section class="kc-panel" data-render-section="mcp-blocked-packs">
          ${w("Unavailable Here","Visible for clarity, but blocked until matching integrations are registered.")}
          ${y.length>0?`<div class="kc-stack-list">${y.map(o=>`
                <div class="kc-note-row kc-note-row-blocked">
                  <div>
                    <strong>${h(o.name??o.id)}</strong>
                    <span>${h(o.unavailablePackReason??"This pack is not available in the current repo.")}</span>
                  </div>
                  <button class="kc-action-button secondary" data-pack-action="blocked" data-pack-id="${h(o.id)}" disabled>Unavailable</button>
                </div>
              `).join("")}</div>`:T("All visible packs are currently executable in this repo.")}
        </section>
      </div>
    </div>
  `}function Bi(e){var i;const t=e.kiwiControl??_,n=t.tokenAnalytics,a=[];if(Gn(t.contextView.task)?a.push({title:"Replace the placeholder task",metric:"task is too broad",note:"The current task label is generic, so Kiwi leans on repo-context and recent-file signals. Preparing with a real goal narrows the selected tree and usually lowers token estimates."}):n.estimationMethod?a.push({title:"Narrow the working set",metric:`${n.fileCountSelected}/${n.fileCountTotal} files`,note:"Use Include, Exclude, and Ignore in Context or Graph to shrink the selected tree before execution. Those tree changes are what alter the next token estimate."}):a.push({title:"Generate a bounded estimate",metric:"prepare first",note:"Run kc prepare with the actual task goal so Kiwi can record a selected working set before showing reduction guidance."}),a.push({title:"Tree drives token estimates",metric:`${t.contextView.tree.selectedCount} selected · ${t.contextView.tree.excludedCount} excluded`,note:"The graph is a projection of the tree. If a file stays selected in the tree, it still counts toward the working-set estimate."}),a.push({title:"Index reuse reduces rescanning",metric:`${t.indexing.indexReusedFiles} reused · ${t.indexing.indexUpdatedFiles} refreshed`,note:"Kiwi reuses index entries when it can and only refreshes changed or newly discovered files. The token estimate is still based on the current selected tree, not random guesses."}),t.wastedFiles.files.length>0&&a.push({title:"Remove wasted files",metric:`~${B(t.wastedFiles.totalWastedTokens)}`,note:`Exclude or ignore ${((i=t.wastedFiles.files[0])==null?void 0:i.file)??"low-value files"} to reduce token use without changing the task goal.`}),t.heavyDirectories.directories.length>0){const s=t.heavyDirectories.directories[0];s&&a.push({title:"Scope the heaviest directory",metric:`${s.percentOfRepo}%`,note:s.suggestion})}return a.push({title:"Understand the tradeoff",metric:n.savingsPercent>0?`~${n.savingsPercent}% saved`:"no savings yet",note:"Smaller context usually lowers tokens and speeds review, but it increases the risk of missing adjacent files or reverse dependents."}),t.measuredUsage.available||a.push({title:"Collect real usage",metric:"estimated only",note:"Measured token usage appears only after local guide, validate, or execution flows record real runs. Until then, the token view is an indexed working-set estimate."}),a}function zi(e){const t=e.kiwiControl??_,n=t.indexing,a=t.contextTrace.initialSignals;return[{title:"Index coverage",metric:`${n.indexedFiles} indexed · ${n.indexUpdatedFiles} refreshed · ${n.indexReusedFiles} reused`,note:n.coverageNote},{title:"Selection signals",metric:`${n.changedSignals} changed · ${n.importSignals} import · ${n.keywordSignals} keyword · ${n.repoContextSignals} repo`,note:"These are the signal buckets Kiwi used to pull files into the working set."},{title:"Observed tree",metric:`${t.contextView.tree.selectedCount} selected · ${t.contextView.tree.candidateCount} candidate · ${t.contextView.tree.excludedCount} excluded`,note:"The repo tree is built from the current context-selection artifact. Selected files are in-scope, candidate files were considered, and excluded files were filtered out."},{title:"Initial evidence",metric:`${a.changedFiles.length} changed · ${a.importNeighbors.length} import neighbors · ${a.keywordMatches.length} keyword matches`,note:"Before Kiwi expands scope, it starts from changed files, import neighbors, keyword matches, recent files, and repo-context files."}]}function Ui(e,t){var a;const n=((a=e.kiwiControl)==null?void 0:a.indexing)??_.indexing;return[{title:"Source of truth",metric:"context tree",note:"This graph is drawn from the current selected/candidate/excluded tree. It is not a full semantic code graph or call graph."},{title:"Visible projection",metric:`${t.nodes.length} nodes · ${t.edges.length} links`,note:`Depth ${ie} controls how much of the current tree projection is visible from the repo root.`},{title:"Highlight behavior",metric:"dependency chain when available",note:"When Kiwi has a structural dependency chain for a file, it highlights that path. Otherwise it falls back to the ancestor path in the tree."},{title:"Indexed evidence behind the map",metric:`${n.changedSignals} changed · ${n.importSignals} import · ${n.keywordSignals} keyword`,note:"Those index signals decide which files appear in the working set before the graph turns them into a visual map."}]}function Gi(e){var n;const t=((n=e.kiwiControl)==null?void 0:n.contextView.tree)??_.contextView.tree;return[{title:"Selected",metric:String(t.selectedCount),note:"Selected files are the current bounded working set. They drive validation expectations and token estimates."},{title:"Candidate",metric:String(t.candidateCount),note:"Candidate files were considered relevant enough to surface, but are not currently in the selected working set."},{title:"Excluded",metric:String(t.excludedCount),note:"Excluded files were filtered by the selector. Local Include/Exclude/Ignore UI edits are session-local until a real CLI command rewrites repo state."}]}function Ki(e){const t=e.kiwiControl??_,n=t.tokenAnalytics;return[{title:"Estimate basis",metric:n.estimationMethod??"heuristic only",note:n.estimateNote??"Kiwi is using the indexed working set to estimate token volume."},{title:"Tree to token path",metric:`${t.contextView.tree.selectedCount} selected files`,note:"The selected tree is the direct input to the working-set token estimate. Excluding a file from the tree is what reduces the next estimate."},{title:"Measured vs estimated",metric:t.measuredUsage.available?`${B(t.measuredUsage.totalTokens)} measured`:"estimate only",note:t.measuredUsage.available?t.measuredUsage.note:"No local execution runs have recorded measured usage yet, so the token numbers are derived from the current indexed tree."},{title:"Index churn",metric:`${t.indexing.indexReusedFiles} reused · ${t.indexing.indexUpdatedFiles} refreshed`,note:"Kiwi does not blindly rescan everything every time. It reuses indexed entries when possible, then recomputes token estimates from the current selected tree."}]}function Wi(e){var a;const t=e.specialists.activeProfile,n=e.specialists.recommendedProfile;return`
    <div class="kc-view-shell">
      <section class="kc-view-header">
        <div>
          <p class="kc-view-kicker">Specialists</p>
          <h1>${h((t==null?void 0:t.name)??e.specialists.activeSpecialist)}</h1>
          <p>${h((t==null?void 0:t.purpose)??"Specialist routing is derived from repo-local role hints, task type, and file area.")}</p>
        </div>
        ${q((t==null?void 0:t.riskPosture)??"active",(t==null?void 0:t.riskPosture)==="conservative"?"success":"neutral")}
      </section>

      <div class="kc-stat-grid">
        ${A("Active",(t==null?void 0:t.name)??e.specialists.activeSpecialist,"current role fit","neutral")}
        ${A("Recommended",(n==null?void 0:n.name)??e.specialists.recommendedSpecialist,"best next handoff","success")}
        ${A("Targets",String(e.specialists.handoffTargets.length),"handoff candidates","neutral")}
        ${A("Preferred Tools",String(((a=t==null?void 0:t.preferredTools)==null?void 0:a.length)??0),"active specialist","neutral")}
      </div>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${w("Active Specialist","The role currently shaping the workspace and compatible capability set.")}
          ${t?bn(t):T("No active specialist is currently recorded.")}
        </section>
        <section class="kc-panel">
          ${w("Routing Safety",e.specialists.safeParallelHint)}
          <div class="kc-stack-list">
            ${R("Current role",e.specialists.activeSpecialist,(t==null?void 0:t.purpose)??"No active specialist profile is available.")}
            ${R("Recommended next",e.specialists.recommendedSpecialist,(n==null?void 0:n.purpose)??"No recommended specialist profile is available.")}
            ${R("Handoff targets",`${e.specialists.handoffTargets.length}`,e.specialists.safeParallelHint)}
          </div>
        </section>
      </div>

      <section class="kc-panel">
        ${w("Specialist Catalog","Available specialists for the current profile, including their role and risk posture.")}
        <div class="kc-fold-grid">
          ${(e.specialists.available??[]).map(i=>`
            <details class="kc-fold-card" ${i.specialistId===e.specialists.activeSpecialist?"open":""}>
              <summary>
                <div>
                  <strong>${h(i.name??i.specialistId)}</strong>
                  <span>${h(i.purpose??"No purpose recorded.")}</span>
                </div>
                ${q(i.riskPosture??"neutral",i.specialistId===e.specialists.activeSpecialist?"success":"neutral")}
              </summary>
              <div class="kc-fold-body">
                ${bn(i)}
              </div>
            </details>
          `).join("")}
        </div>
      </section>
    </div>
  `}function qi(e){var y;const t=e.kiwiControl??_,n=Math.max(0,t.execution.totalExecutions-Math.round(t.execution.successRate/100*t.execution.totalExecutions)),a=ss(e),i=t.workflow.steps.filter(o=>o.status==="success").length,s=t.workflow.steps.find(o=>o.status==="failed")??null,r=at(e,"execution-plan"),c=at(e,"workflow"),u=at(e,"runtime-lifecycle"),d=at(e,"decision-logic");return`
    <div class="kc-view-shell">
      <section class="kc-view-header">
        <div>
          <p class="kc-view-kicker">System State</p>
          <h1>System visibility</h1>
          <p>Execution health, indexing coverage, adaptive learning, and repo-control operating signals.</p>
        </div>
        ${q(t.execution.tokenTrend,t.execution.tokenTrend==="improving"?"success":t.execution.tokenTrend==="worsening"?"warn":"neutral")}
      </section>

      <div class="kc-stat-grid">
        ${A("Executions",String(t.execution.totalExecutions),"tracked runs","neutral")}
        ${A("Failures",String(n),"recorded scope or completion failures",n>0?"warn":"success")}
        ${A("Success Rate",`${t.execution.successRate}%`,"real completion history",t.execution.successRate>=80?"success":"warn")}
        ${A("Feedback Strength",t.feedback.adaptationLevel,`${t.feedback.totalRuns} successful runs`,t.feedback.adaptationLevel==="active"?"success":"neutral")}
        ${A("Lifecycle",e.executionState.lifecycle,e.executionState.reason??e.readiness.detail,e.executionState.lifecycle==="blocked"||e.executionState.lifecycle==="failed"?"warn":"neutral")}
        ${A("Workflow",t.workflow.status,t.workflow.currentStepId??"no current step",t.workflow.status==="failed"?"warn":"neutral")}
      </div>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${w("Indexing & Structure",t.indexing.coverageNote)}
          <div class="kc-info-grid">
            ${C("Observed files",String(t.indexing.observedFiles))}
            ${C("Discovered files",String(t.indexing.discoveredFiles))}
            ${C("Indexed files",String(t.indexing.indexedFiles))}
            ${C("Impact files",String(t.indexing.impactFiles))}
            ${C("Visited directories",String(t.indexing.visitedDirectories))}
            ${C("Max depth",String(t.indexing.maxDepthExplored))}
            ${C("Changed signals",String(t.indexing.changedSignals))}
            ${C("Repo-context signals",String(t.indexing.repoContextSignals))}
          </div>
          <div class="kc-divider"></div>
          <div class="kc-inline-badges">
            ${z(t.indexing.fileBudgetReached?"file budget limited":"file budget clear")}
            ${z(t.indexing.directoryBudgetReached?"dir budget limited":"dir budget clear")}
            ${z(`scope: ${t.indexing.scopeArea??"unknown"}`)}
          </div>
        </section>
        <section class="kc-panel">
          ${w("Execution Health","Real runtime accounting from repo-local execution history.")}
          ${a.length>0?`<div class="kc-timeline">${a.slice(0,5).map(o=>`
                <article class="kc-timeline-item">
                  <div class="kc-timeline-marker ${o.tone}">
                    ${o.icon}
                  </div>
                  <div class="kc-timeline-copy">
                    <div class="kc-timeline-head">
                      <strong>${h(o.title)}</strong>
                      <span>${h(o.timestamp)}</span>
                    </div>
                    <p>${h(o.detail)}</p>
                  </div>
                </article>
              `).join("")}</div>`:T("No execution history has been recorded yet.")}
        </section>
      </div>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${w("Task Lifecycle",`A runtime-derived lifecycle snapshot from prepare to packet generation, checkpoint, and handoff. ${u}`)}
          <div class="kc-stack-list">
            ${R("Current stage",e.executionState.lifecycle,e.executionState.reason??e.readiness.detail)}
            ${R("Validation",t.runtimeLifecycle.validationStatus??"unknown",t.runtimeLifecycle.nextSuggestedCommand??"No suggested command is recorded yet.")}
            ${R("Task",t.runtimeLifecycle.currentTask??"none recorded",((y=t.runtimeLifecycle.recentEvents[0])==null?void 0:y.summary)??"No lifecycle events are recorded yet.")}
          </div>
        </section>
        <section class="kc-panel">
          ${w("Waste & Weight","Files and directories that inflate scope without helping the task.")}
          ${t.wastedFiles.files.length>0?`<div class="kc-stack-list">${t.wastedFiles.files.slice(0,4).map(o=>R(o.file,`${B(o.tokens)} tokens`,o.reason)).join("")}</div>`:T("No wasted files are recorded in the current selection.")}
        </section>
        <section class="kc-panel">
          ${w("Heavy Directories","Areas that dominate estimated token volume and deserve tighter scoping.")}
          ${t.heavyDirectories.directories.length>0?`<div class="kc-stack-list">${t.heavyDirectories.directories.slice(0,4).map(o=>R(o.directory,`${o.percentOfRepo}%`,o.suggestion)).join("")}</div>`:T("No heavy-directory signal is recorded for this repo yet.")}
        </section>
      </div>

      <section class="kc-panel">
        ${w("Next Commands",`Exact CLI commands from the runtime-derived execution plan. ${r}`)}
        ${t.executionPlan.nextCommands.length>0?qe(t.executionPlan.nextCommands):T("No next commands are currently recorded.")}
      </section>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${w("Workflow Steps",`Runtime-derived workflow snapshot for the active task. ${c}`)}
          <div class="kc-inline-badges">
            ${z(`${i}/${t.workflow.steps.length} successful`)}
            ${z(s?`failed: ${s.action}`:"no failed step")}
          </div>
          ${s!=null&&s.failureReason?`<div class="kc-divider"></div>${R("Failure reason",s.action,s.failureReason)}`:""}
          ${t.workflow.steps.length>0?`<div class="kc-stack-list">${t.workflow.steps.map(o=>R(`${o.action}`,`${o.status}${o.retryCount>0?` · retry ${o.retryCount}`:""}${o.attemptCount>0?` · attempt ${o.attemptCount}`:""}`,o.failureReason??o.result.summary??o.validation??o.expectedOutput??o.result.suggestedFix??o.tokenUsage.note)).join("")}</div>`:T("No workflow state has been recorded yet.")}
        </section>
        <section class="kc-panel">
          ${w("Execution Trace","What executed, which files were used, which skills applied, and token usage per step.")}
          ${t.executionTrace.steps.length>0?`<div class="kc-stack-list">${t.executionTrace.steps.map(o=>R(o.action,o.tokenUsage.source==="none"?`${o.status}${o.retryCount>0?` · retry ${o.retryCount}`:""}`:`${o.status}${o.retryCount>0?` · retry ${o.retryCount}`:""} · ${o.tokenUsage.measuredTokens!=null?B(o.tokenUsage.measuredTokens):`~${B(o.tokenUsage.estimatedTokens??0)}`}`,o.failureReason?`${o.failureReason}${o.files.length>0?` | files: ${o.files.slice(0,3).join(", ")}`:""}`:`${o.result.summary??(o.files.slice(0,3).join(", ")||"no files")}${o.skillsApplied.length>0?` | skills: ${o.skillsApplied.join(", ")}`:""}${o.result.validation?` | validation: ${o.result.validation}`:o.expectedOutput?` | expects: ${o.expectedOutput}`:""}${o.result.retryCommand?` | retry: ${o.result.retryCommand}`:""}`)).join("")}</div>`:T("No execution trace is available yet.")}
        </section>
      </div>

      <section class="kc-panel">
        ${w("DECISION LOGIC",`Runtime-derived decision snapshot showing which signals won and which signals were intentionally ignored. ${d}`)}
        <div class="kc-two-column">
          <section class="kc-subpanel">
            ${w("Reasoning chain",t.decisionLogic.summary||"No decision summary recorded.")}
            ${t.decisionLogic.reasoningChain.length>0?`<div class="kc-stack-list">${t.decisionLogic.reasoningChain.map(o=>we(o)).join("")}</div>`:T("No reasoning chain is available yet.")}
          </section>
          <section class="kc-subpanel">
            ${w("Ignored signals","Signals Kiwi saw but did not let dominate the next action.")}
            ${t.decisionLogic.ignoredSignals.length>0?`<div class="kc-stack-list">${t.decisionLogic.ignoredSignals.map(o=>we(o)).join("")}</div>`:T("No ignored signals are currently recorded.")}
          </section>
        </div>
      </section>

      <section class="kc-panel">
        ${w("Runtime Events",`Hook-style events emitted by Kiwi’s lightweight runtime integration. ${u}`)}
        ${t.runtimeLifecycle.recentEvents.length>0?`<div class="kc-stack-list">${t.runtimeLifecycle.recentEvents.slice(0,6).map(o=>R(`${o.type} · ${o.stage}`,o.status,o.summary)).join("")}</div>`:T("No runtime events are recorded yet.")}
      </section>

      <section class="kc-panel">
        ${w("Ecosystem Discovery","Read-only external capability metadata used to inform decisions without executing tools directly.")}
        <div class="kc-two-column">
          <section class="kc-subpanel">
            ${w("Known tools","Selected tools and ecosystems from Awesome Copilot and Awesome Claude Code.")}
            <div class="kc-stack-list">
              ${e.ecosystem.tools.slice(0,5).map(o=>R(o.name,o.category,o.description)).join("")}
            </div>
          </section>
          <section class="kc-subpanel">
            ${w("Known workflows","Advisory workflow patterns only.")}
            <div class="kc-stack-list">
              ${e.ecosystem.workflows.slice(0,4).map(o=>R(o.name,o.source,o.description)).join("")}
            </div>
          </section>
        </div>
      </section>
    </div>
  `}function Yi(e){return xa({state:e,activeMode:$e,helpers:et()})}function at(e,t){const n=e.derivedFreshness.find(a=>a.outputName===t);return n?`Compatibility/debug snapshot${n.sourceRevision!=null?` · revision ${n.sourceRevision}`:""}${n.generatedAt?` · generated ${n.generatedAt}`:""}.`:"Compatibility/debug snapshot."}function Ji(e){const n=(e.kiwiControl??_).feedback,a=n.totalRuns>0||n.topBoostedFiles.length>0||n.topPenalizedFiles.length>0||n.recentEntries.length>0||n.basedOnPastRuns,i=n.topBoostedFiles.slice(0,4),s=n.topPenalizedFiles.slice(0,4),r=n.recentEntries.slice(0,6),c=[];return i.length>0&&c.push(`
      <section class="kc-panel">
        ${w("Boosted Files","Files that helped successful runs in this task scope.")}
        <div class="kc-stack-list">${i.map(u=>$n(u.file,u.score,"success")).join("")}</div>
      </section>
    `),s.length>0&&c.push(`
      <section class="kc-panel">
        ${w("Penalized Files","Files Kiwi is learning to avoid for this task scope.")}
        <div class="kc-stack-list">${s.map(u=>$n(u.file,u.score,"warn")).join("")}</div>
      </section>
    `),n.basedOnPastRuns&&c.push(`
      <section class="kc-panel">
        ${w("Retrieval Reuse","Only shown when Kiwi is confidently reusing a past pattern.")}
        <div class="kc-stack-list">
          ${R("Reused pattern",n.reusedPattern??"similar work",n.note)}
          ${n.similarTasks.slice(0,4).map(u=>R(u.task,`similarity ${u.similarity}`,re(u.timestamp))).join("")}
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
        ${q(`${n.totalRuns} runs`,n.adaptationLevel==="active"?"success":"neutral")}
      </section>

      ${a?`
      <div class="kc-stat-grid">
        ${A("Valid Runs",String(n.totalRuns),"successful completions","neutral")}
        ${A("Success Rate",`${n.successRate}%`,"repo-local",n.successRate>=80?"success":"neutral")}
        ${A("Learned Files",String(n.topBoostedFiles.length+n.topPenalizedFiles.length),"boosted and penalized",n.topBoostedFiles.length>0?"success":n.topPenalizedFiles.length>0?"warn":"neutral")}
        ${A("Reuse",n.basedOnPastRuns?"active":"idle",n.basedOnPastRuns?"pattern reuse engaged":"fresh selection first",n.basedOnPastRuns?"success":"neutral")}
      </div>

      <section class="kc-panel">
        ${w("Recent Completions","Only valid successful completions train future selection behavior.")}
        ${r.length>0?`<div class="kc-stack-list">${r.map(u=>`
              <div class="kc-note-row">
                <div>
                  <strong>${h(u.task)}</strong>
                  <span>${h(`${u.filesUsed}/${u.filesSelected} files used · ${re(u.timestamp)}`)}</span>
                </div>
                ${q(u.success?"success":"fail",u.success?"success":"warn")}
              </div>
            `).join("")}</div>`:T("No recent feedback events are available yet.")}
      </section>

      ${c.length>0?`<div class="kc-two-column">${c.join("")}</div>`:""}
      `:`
          <section class="kc-panel">
            ${w("Adaptive Feedback","Kiwi keeps this quiet until successful runtime-backed work creates useful signal.")}
            <div class="kc-stack-list">
              ${R("Current state",n.adaptationLevel,n.note)}
              ${R("What to do next","keep working normally","Use the main runtime-backed flow first. This page grows only when there is real signal to show.")}
            </div>
          </section>
        `}
    </div>
  `}function Xi(e){e.kiwiControl;const t=L,n=t?Ft.get(t.id)??"unmarked":"unmarked";return ba({...wa({state:e,focusedItem:t,marker:n,activeMode:$e,commandState:v,resolveFocusedStep:a=>(a==null?void 0:a.kind)==="step"?Xe(e).find(i=>i.id===a.id)??null:null,resolveFocusedNode:a=>(a==null?void 0:a.kind)==="path"?Un(e,a.path):null}),helpers:{...et(),renderGateRow:Zn,renderBulletRow:we}})}function Qi(e){var n;const t=Xe(e);return ka({...{state:e,steps:t,editingPlanStepId:_e,editingPlanDraft:ye,focusedItem:L,commandState:v,failureGuidance:ca(((n=e.kiwiControl)==null?void 0:n.executionPlan.lastError)??null)},helpers:{escapeHtml:h,escapeAttribute:Yt,formatCliCommand:be,renderPanelHeader:w,renderInlineBadge:z,renderNoteRow:R,renderEmptyState:T,renderHeaderBadge:q}})}function Zi(e){const t=cs(e),n=os(e),a=n.length>0?n.map(i=>`
        <div class="kc-log-line ${i.tone}">
          <span>${h(i.label)}</span>
          <strong>${h(i.value)}</strong>
        </div>
      `).join(""):rs(e);return`
    <div class="kc-log-shell">
      <div class="kc-log-header">
        ${$e==="inspection"?`<div class="kc-tab-row">
              ${Ae("history",Te,"Execution History","data-log-tab")}
              ${Ae("validation",Te,"Validation Output","data-log-tab")}
              ${Ae("logs",Te,"System Logs","data-log-tab")}
            </div>`:`<div class="kc-tab-row">${Ae("history","history","Execution History")}</div>`}
        <button class="kc-icon-button" type="button" data-toggle-logs>
          ${F("close")}
        </button>
      </div>
      <div class="kc-log-body">
        ${$e==="execution"?a:Te==="validation"?es(e.validation):Te==="history"?a:t.length>0?t.map(i=>`
                <div class="kc-log-line">
                  <span>${h(i.label)}</span>
                  <strong>${h(i.value)}</strong>
                </div>
              `).join(""):T("No repo activity is recorded yet.")}
      </div>
    </div>
  `}function es(e){const t=e.issues??[];return t.length===0?'<div class="kc-log-line"><span>info</span><strong>Repo validation is currently passing.</strong></div>':t.map(n=>`
    <div class="kc-log-line ${n.level==="error"?"is-error":n.level==="warn"?"is-warn":""}">
      <span>${h(n.level)}</span>
      <strong>${h(`${n.filePath?`${n.filePath}: `:""}${n.message}`)}</strong>
    </div>
  `).join("")}function A(e,t,n,a){return`
    <article class="kc-stat-card tone-${a}">
      <span>${h(e)}</span>
      <strong>${h(t)}</strong>
      <em>${h(n)}</em>
    </article>
  `}function Ct(e,t){return`
    <div class="kc-small-metric">
      <strong>${h(e)}</strong>
      <span>${h(t)}</span>
    </div>
  `}function w(e,t){return`
    <header class="kc-panel-header">
      <div>
        <p>${h(e)}</p>
        <h3>${h(e)}</h3>
      </div>
      <span>${h(t)}</span>
    </header>
  `}function C(e,t,n="default"){return`
    <div class="kc-info-row">
      <span>${h(e)}</span>
      <strong class="${n==="warn"?"is-warn":""}">${h(t)}</strong>
    </div>
  `}function ts(e){const t=e.toLowerCase();return t.includes("low confidence")?"May miss relevant files or choose the wrong working set.":t.includes("partial scan")?"Repo understanding may be incomplete until context expands.":t.includes("changed files")?"Recent edits can dominate the plan and change the safest next step.":t.includes("reverse depend")?"Downstream breakage can be missed if structural dependents are ignored.":t.includes("keyword")?"Task matching may drift away from the user’s actual request.":t.includes("repo context")?"Repo-local authority and critical files may be skipped.":"Ignoring this signal can reduce decision quality or hide relevant files."}function q(e,t){return`<span class="kc-badge badge-${h(t==="bridge-unavailable"||t==="low"?"warn":t==="medium"?"neutral":t==="high"?"success":t)}">${h(e)}</span>`}function Zn(e,t,n){return`
    <div class="kc-info-row kc-gate-row">
      <span>${h(e)}</span>
      <strong class="${n==="warn"?"is-warn":n==="success"?"is-success":""}">${h(t)}</strong>
    </div>
  `}function Ae(e,t,n,a="data-validation-tab"){return`<button class="kc-tab-button ${e===t?"is-active":""}" type="button" ${a}="${h(e)}">${h(n)}</button>`}function qe(e){return`<div class="kc-inline-badges">${e.map(t=>`<span class="kc-inline-badge">${h(t)}</span>`).join("")}</div>`}function z(e){return`<span class="kc-inline-badge">${h(e)}</span>`}function lt(e,t){return`<span class="kc-inline-badge ${t?"is-active":"is-muted"}">${h(e)}</span>`}function we(e){return`
    <div class="kc-bullet-row">
      <span class="kc-bullet-dot"></span>
      <span>${h(e)}</span>
    </div>
  `}function ns(e){return`
    <article class="kc-capability-card">
      <div class="kc-capability-head">
        <div>
          <strong>${h(e.id)}</strong>
          <span>${h(e.category)}</span>
        </div>
        ${q(e.trustLevel,e.trustLevel==="high"?"success":e.trustLevel==="low"?"warn":"neutral")}
      </div>
      <p>${h(e.purpose)}</p>
      <div class="kc-inline-badges">
        ${z(e.readOnly?"read only":"read write")}
        ${z(e.writeCapable?"write capable":"no writes")}
        ${z(e.approvalRequired?"approval required":"self-serve")}
      </div>
      ${e.usageGuidance.length>0?`<div class="kc-capability-notes">${e.usageGuidance.slice(0,2).map(we).join("")}</div>`:""}
    </article>
  `}function bn(e){return`
    <div class="kc-stack-list">
      <div class="kc-note-row">
        <div>
          <strong>${h(e.name??e.specialistId)}</strong>
          <span>${h(e.purpose??"No purpose recorded.")}</span>
        </div>
        <em>${h(e.riskPosture??"unknown")}</em>
      </div>
      <div class="kc-inline-badges">
        ${z(`id: ${e.specialistId}`)}
        ${z(`tools: ${(e.preferredTools??[]).join(", ")||"none"}`)}
        ${z(`aliases: ${(e.aliases??[]).join(", ")||"none"}`)}
      </div>
    </div>
  `}function $n(e,t,n){return`
    <div class="kc-score-row">
      <span>${h(e)}</span>
      <strong class="tone-${n}">${t>0?`+${t}`:`${t}`}</strong>
    </div>
  `}function as(e,t,n,a){const i=n>0?Math.max(6,Math.round(t/n*100)):6;return`
    <div class="kc-bar-row">
      <div class="kc-bar-copy">
        <strong>${h(e)}</strong>
        <span>${h(`${B(t)} · ${a}`)}</span>
      </div>
      <div class="kc-bar-track"><div class="kc-bar-fill" style="width: ${i}%"></div></div>
    </div>
  `}function R(e,t,n){return`
    <div class="kc-note-row">
      <div>
        <strong>${h(e)}</strong>
        <span>${h(n)}</span>
      </div>
      <em>${h(t)}</em>
    </div>
  `}function yn(e,t,n){if(n<=0)return"";const a=Math.max(0,Math.min(100,Math.round(t/n*100)));return`
    <div class="kc-meter-row">
      <div class="kc-meter-copy">
        <span>${h(e)}</span>
        <strong>${a}%</strong>
      </div>
      <div class="kc-meter-track"><div class="kc-meter-fill" style="width: ${a}%"></div></div>
    </div>
  `}function is(e){return`
    <article class="kc-issue-card issue-${h(e.level)}">
      <div>
        <strong>${h(e.filePath??"repo contract")}</strong>
        <span>${h(e.message)}</span>
      </div>
      ${q(e.level,e.level==="error"?"critical":"warn")}
    </article>
  `}function T(e){return`<p class="kc-empty-state">${h(e)}</p>`}function ea(e){return ga({tree:e,focusedItem:L,contextOverrides:de,helpers:{escapeHtml:h,escapeAttribute:Yt,renderEmptyState:T}})}function ss(e){const t=e.kiwiControl??_,n=[];for(const r of t.execution.recentExecutions)n.push({title:r.success?"Execution completed":"Execution failed",detail:`${r.task} · ${r.filesTouched} files touched`,timestamp:re(r.timestamp),tone:r.success?"tone-success":"tone-warn",icon:r.success?F("check"):F("alert"),...r.tokensUsed>0?{meta:[`~${B(r.tokensUsed)} tokens`]}:{}});for(const r of t.runtimeLifecycle.recentEvents.slice(0,4))n.push({title:`Runtime ${r.type}`,detail:r.summary,timestamp:re(r.timestamp),tone:r.status==="error"?"tone-warn":r.status==="warn"?"tone-neutral":"tone-success",icon:r.status==="error"?F("alert"):r.status==="warn"?F("system"):F("check"),...r.files.length>0?{meta:r.files.slice(0,3)}:{}});const a=ve(e.continuity,"Latest checkpoint");a!=="none recorded"&&n.push({title:"Checkpoint updated",detail:a,timestamp:"repo-local",tone:"tone-neutral",icon:F("checkpoint")});const i=ve(e.continuity,"Latest handoff");i!=="none recorded"&&n.push({title:"Handoff available",detail:i,timestamp:"repo-local",tone:"tone-neutral",icon:F("handoffs")});const s=ve(e.continuity,"Latest reconcile");return s!=="none recorded"&&n.push({title:"Reconcile state updated",detail:s,timestamp:"repo-local",tone:"tone-neutral",icon:F("activity")}),n.slice(0,8)}function wn(e){return e.replace(/[-_]+/g," ").replace(/\b\w/g,t=>t.toUpperCase())}function os(e){const t=e.kiwiControl??_;return t.executionEvents.recentEvents.length>0?t.executionEvents.recentEvents.slice(0,10).map(n=>{const a=n.reason??n.sourceCommand??n.task??n.nextCommand??"No runtime detail recorded.",i=Object.keys(n.artifacts).length>0?"artifacts updated":null;return{label:wn(n.eventType),value:`${a}${i?` · ${i}`:""} · ${re(n.recordedAt)}`,tone:n.lifecycle==="failed"?"is-error":n.lifecycle==="blocked"?"is-warn":""}}):t.runtimeLifecycle.recentEvents.length>0?t.runtimeLifecycle.recentEvents.slice(0,8).map(n=>({label:wn(n.type),value:`${n.summary} · ${re(n.timestamp)}`,tone:n.status==="error"?"is-error":n.status==="warn"?"is-warn":""})):t.execution.recentExecutions.slice(0,8).map(n=>({label:n.success?"Run":"Failed run",value:`${n.task} · ${n.filesTouched} files · ~${B(n.tokensUsed)} tokens · ${re(n.timestamp)}`,tone:n.success?"":"is-warn"}))}function rs(e){const t=(e.kiwiControl??_).executionEvents.source;return T(t==="runtime"?"Runtime execution events are available for this repo, but no recent entries are recorded yet.":t==="compatibility"?"The repo-local compatibility event log is empty right now. Runtime event history is not currently available.":"Runtime execution event history is unavailable for this repo right now.")}function cs(e){return[...(e.kiwiControl??_).execution.recentExecutions.map(a=>({label:a.success?"run":"run failed",value:`${a.task} · ${a.filesTouched} files · ${re(a.timestamp)}`})),...e.continuity.slice(0,3).map(a=>({label:a.label,value:a.value}))].slice(0,8)}function ta(e,t){return`<span class="kc-icon-label">${e}<em>${h(t)}</em></span>`}function F(e){const t='viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';switch(e){case"overview":return`<svg ${t}><rect x="3" y="4" width="7" height="7"/><rect x="14" y="4" width="7" height="7"/><rect x="3" y="13" width="7" height="7"/><rect x="14" y="13" width="7" height="7"/></svg>`;case"context":return`<svg ${t}><path d="M4 19V5h16v14Z"/><path d="M8 9h8"/><path d="M8 13h5"/></svg>`;case"graph":return`<svg ${t}><circle cx="12" cy="12" r="2"/><circle cx="6" cy="7" r="2"/><circle cx="18" cy="7" r="2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/><path d="M10.5 10.5 7.5 8.5"/><path d="m13.5 10.5 3-2"/><path d="m10.8 13.4-2.5 3"/><path d="m13.2 13.4 2.5 3"/></svg>`;case"validation":return`<svg ${t}><path d="M12 3 4 7v6c0 4.5 3.2 6.9 8 8 4.8-1.1 8-3.5 8-8V7Z"/><path d="m9 12 2 2 4-4"/></svg>`;case"activity":return`<svg ${t}><path d="M3 12h4l2-4 4 8 2-4h6"/></svg>`;case"tokens":return`<svg ${t}><circle cx="12" cy="12" r="8"/><path d="M9 12h6"/><path d="M12 9v6"/></svg>`;case"handoffs":return`<svg ${t}><path d="m7 7 5-4 5 4"/><path d="M12 3v14"/><path d="m17 17-5 4-5-4"/></svg>`;case"feedback":return`<svg ${t}><path d="M12 3v6"/><path d="m15 12 6-3"/><path d="m9 12-6-3"/><path d="m15 15 4 4"/><path d="m9 15-4 4"/><circle cx="12" cy="12" r="3"/></svg>`;case"mcps":return`<svg ${t}><path d="M4 12h16"/><path d="M12 4v16"/><path d="m6.5 6.5 11 11"/><path d="m17.5 6.5-11 11"/></svg>`;case"specialists":return`<svg ${t}><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/></svg>`;case"system":return`<svg ${t}><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 4v16"/><path d="M15 4v16"/><path d="M4 9h16"/><path d="M4 15h16"/></svg>`;case"logs-open":return`<svg ${t}><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h10"/><path d="m19 15-3 3 3 3"/></svg>`;case"logs-closed":return`<svg ${t}><path d="M4 6h16"/><path d="M4 12h10"/><path d="M4 18h16"/><path d="m15 9 3 3-3 3"/></svg>`;case"panel-open":return`<svg ${t}><rect x="3" y="4" width="18" height="16"/><path d="M15 4v16"/></svg>`;case"panel-closed":return`<svg ${t}><rect x="3" y="4" width="18" height="16"/><path d="M9 4v16"/></svg>`;case"close":return`<svg ${t}><path d="m6 6 12 12"/><path d="m18 6-12 12"/></svg>`;case"refresh":return`<svg ${t}><path d="M20 11a8 8 0 0 0-14.9-3"/><path d="M4 4v5h5"/><path d="M4 13a8 8 0 0 0 14.9 3"/><path d="M20 20v-5h-5"/></svg>`;case"check":return`<svg ${t}><path d="m5 12 4 4 10-10"/></svg>`;case"alert":return`<svg ${t}><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/></svg>`;case"checkpoint":return`<svg ${t}><path d="M6 4h12v6H6z"/><path d="M9 10v10"/><path d="M15 10v10"/></svg>`;case"sun":return`<svg ${t}><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`;case"moon":return`<svg ${t}><path d="M12 3a6 6 0 1 0 9 9A9 9 0 1 1 12 3Z"/></svg>`;default:return`<svg ${t}><circle cx="12" cy="12" r="8"/></svg>`}}function B(e){const t=Math.abs(e),n=[{value:1e12,suffix:"T"},{value:1e9,suffix:"B"},{value:1e6,suffix:"M"},{value:1e3,suffix:"K"}];for(const a of n)if(t>=a.value)return`${(e/a.value).toFixed(1).replace(/\.0$/,"")}${a.suffix}`;return na(e)}function na(e){return e.toLocaleString("en-US")}function ls(e){return e==null?"n/a":`${e.toFixed(1)}%`}function ds(e){return e==null?"—":`$${e.toFixed(2)}`}function re(e){if(!e)return"unknown time";const t=new Date(e);return Number.isNaN(t.getTime())?e:t.toLocaleString(void 0,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})}function ve(e,t){var n;return((n=e.find(a=>a.label===t))==null?void 0:n.value)??"none recorded"}function Gt(e){if(!e)return"No repo loaded";const t=e.split(/[\\/]/).filter(Boolean);return t[t.length-1]??e}function Kt(e){return Da(e,S)}function us(e){switch(e){case"source-bundle":return"local source bundle";case"installed-bundle":return"installed bundle";default:return"fallback launcher"}}function kt(e,t){return _a(e,t,zt(e))}async function aa(){if(!j())return null;try{return await U("consume_initial_launch_request")}catch{return null}}async function ia(e,t=!1){return j()?await U("load_repo_control_state",{targetRoot:e,preferSnapshot:t}):qt(e)}async function Wt(e,t){if(!(!j()||!e))try{await U("set_active_repo_target",{targetRoot:e,revision:t})}catch{}}function qt(e){const t=e.trim().length>0,n=t?e:"";return{targetRoot:n,loadState:{source:"bridge-fallback",freshness:"failed",generatedAt:new Date().toISOString(),snapshotSavedAt:null,snapshotAgeMs:null,detail:t?"Repo-local state could not be loaded from the Kiwi bridge.":"No repo is loaded yet."},profileName:"default",executionMode:"local",projectType:"unknown",repoState:{mode:"bridge-unavailable",title:t?"Could not load this repo yet":"Open a repo",detail:t?"Kiwi Control could not read repo-local state for this folder yet.":"Run kc ui inside a repo to load it automatically.",sourceOfTruthNote:"Repo-local artifacts under .agent/ and promoted repo instruction files remain the source of truth. The desktop app never replaces that state."},executionState:{revision:0,operationId:null,task:null,sourceCommand:null,lifecycle:"failed",reason:t?"Kiwi Control could not read repo-local execution state for this folder yet.":"No repo is loaded yet.",nextCommand:t?"kc ui":"kc init",blockedBy:t?["Repo-local execution state is unavailable."]:[],lastUpdatedAt:null},readiness:{label:t?"Desktop bridge unavailable":"Open a repo",tone:"failed",detail:t?"Kiwi Control could not read repo-local execution state for this folder yet.":"Run kc ui inside a repo to load it automatically.",nextCommand:t?"kc ui":"kc init"},runtimeIdentity:null,derivedFreshness:[],runtimeDecision:{currentStepId:"idle",currentStepLabel:"Idle",currentStepStatus:"failed",nextCommand:t?"kc ui":"kc init",readinessLabel:t?"Desktop bridge unavailable":"Open a repo",readinessTone:"failed",readinessDetail:t?"Kiwi Control could not read repo-local execution state for this folder yet.":"Run kc ui inside a repo to load it automatically.",nextAction:{action:t?"Restore the desktop bridge":"Open a repo",command:t?"kc ui":"kc init",reason:t?"Kiwi Control could not read repo-local execution state for this folder yet.":"Run kc ui inside a repo to load it automatically.",priority:"critical"},recovery:{kind:"failed",reason:t?"Kiwi Control could not read repo-local execution state for this folder yet.":"Run kc ui inside a repo to load it automatically.",fixCommand:t?"kc ui":"kc init",retryCommand:t?"kc ui":"kc init"},decisionSource:"bridge-fallback",updatedAt:new Date().toISOString()},repoOverview:[{label:"Project type",value:t?"unknown (awaiting repo bridge)":"no repo loaded",...t?{tone:"warn"}:{}},{label:"Active role",value:"none recorded"},{label:"Next file",value:t?".agent/project.yaml":"run kc ui inside a repo"},{label:"Next command",value:t?"kc ui":"kc init"},{label:"Validation state",value:t?"bridge unavailable":"waiting for repo",...t?{tone:"warn"}:{}},{label:"Current phase",value:t?"restore repo bridge":"load a repo"}],continuity:[{label:"Latest checkpoint",value:"none recorded"},{label:"Latest handoff",value:"none recorded"},{label:"Latest reconcile",value:"none recorded"},{label:"Current focus",value:t?`reload repo-local state for ${n}`:"open a repo from the CLI"},{label:"Open risks",value:t?"Cannot read repo-local state yet.":"No repo loaded.",tone:"warn"}],memoryBank:[],specialists:{activeSpecialist:"review-specialist",recommendedSpecialist:"review-specialist",activeProfile:null,recommendedProfile:null,handoffTargets:[],safeParallelHint:"Restore repo-local visibility first."},mcpPacks:{selectedPack:{id:"core-pack",description:"Default repo-first pack."},selectedPackSource:"heuristic-default",explicitSelection:null,suggestedPack:{id:"core-pack",description:"Default repo-first pack.",guidance:[],realismNotes:[]},available:[],compatibleCapabilities:[],effectiveCapabilityIds:[],preferredCapabilityIds:[],executable:!1,unavailablePackReason:"Pack selection is unavailable until repo-local state can be loaded.",capabilityStatus:"limited",note:"No compatible MCP integrations are available until repo-local state can be loaded."},validation:{ok:!1,errors:t?1:0,warnings:t?0:1,issues:[]},ecosystem:{artifactType:"kiwi-control/ecosystem-catalog",version:1,timestamp:new Date().toISOString(),tools:[],workflows:[],capabilities:[],notes:["Ecosystem metadata becomes available once repo-local state loads."]},machineAdvisory:{artifactType:"kiwi-control/machine-advisory",version:3,generatedBy:"kiwi-control machine-advisory",windowDays:7,updatedAt:"",stale:!0,sections:{inventory:{status:"partial",updatedAt:"",reason:"Machine-local advisory is unavailable."},mcpInventory:{status:"partial",updatedAt:"",reason:"Machine-local advisory is unavailable."},optimizationLayers:{status:"partial",updatedAt:"",reason:"Machine-local advisory is unavailable."},setupPhases:{status:"partial",updatedAt:"",reason:"Machine-local advisory is unavailable."},configHealth:{status:"partial",updatedAt:"",reason:"Machine-local advisory is unavailable."},usage:{status:"partial",updatedAt:"",reason:"Machine-local advisory is unavailable."},guidance:{status:"partial",updatedAt:"",reason:"Machine-local advisory is unavailable."}},inventory:[],mcpInventory:{claudeTotal:0,codexTotal:0,copilotTotal:0,tokenServers:[]},optimizationLayers:[],setupPhases:[],configHealth:[],skillsCount:0,copilotPlugins:[],usage:{days:7,claude:{available:!1,days:[],totals:{inputTokens:0,outputTokens:0,cacheCreationTokens:0,cacheReadTokens:0,totalTokens:0,totalCost:null,cacheHitRatio:null},note:"Machine-local advisory is unavailable."},codex:{available:!1,days:[],totals:{inputTokens:0,outputTokens:0,cachedInputTokens:0,reasoningOutputTokens:0,sessions:0,totalTokens:0,cacheHitRatio:null},note:"Machine-local advisory is unavailable."},copilot:{available:!1,note:"Machine-local advisory is unavailable."}},optimizationScore:{planning:{label:"planning",score:0,earnedPoints:0,maxPoints:100,activeSignals:[],missingSignals:[]},execution:{label:"execution",score:0,earnedPoints:0,maxPoints:100,activeSignals:[],missingSignals:[]},assistant:{label:"assistant",score:0,earnedPoints:0,maxPoints:100,activeSignals:[],missingSignals:[]}},setupSummary:{installedTools:{readyCount:0,totalCount:0},healthyConfigs:{readyCount:0,totalCount:0},activeTokenLayers:[],readyRuntimes:{planning:!1,execution:!1,assistant:!1}},systemHealth:{criticalCount:0,warningCount:0,okCount:0},guidance:[],note:"Machine-local advisory is unavailable."},kiwiControl:_}}function h(e){return e.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;")}function Yt(e){return h(e)}function j(){return typeof window<"u"&&"__TAURI_INTERNALS__"in window}
