(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const a of document.querySelectorAll('link[rel="modulepreload"]'))i(a);new MutationObserver(a=>{for(const s of a)if(s.type==="childList")for(const o of s.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&i(o)}).observe(document,{childList:!0,subtree:!0});function n(a){const s={};return a.integrity&&(s.integrity=a.integrity),a.referrerPolicy&&(s.referrerPolicy=a.referrerPolicy),a.crossOrigin==="use-credentials"?s.credentials="include":a.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function i(a){if(a.ep)return;a.ep=!0;const s=n(a);fetch(a.href,s)}})();function ti(e,t){var n,i,a,s,o,l,d,p;return t.lastRepoLoadFailure&&si(e.loadState.source)?{tone:"degraded",title:e.loadState.source==="stale-snapshot"?"Using older snapshot":"Using cached snapshot",detail:`Kiwi kept the last usable snapshot because fresh repo-local state failed to load. It is safe for inspection, but not trusted for workflow execution: ${t.lastRepoLoadFailure}`,nextCommand:null,actionLabel:"Reload state"}:e.repoState.mode==="bridge-unavailable"||e.loadState.source==="bridge-fallback"?{tone:"failed",title:"Desktop bridge unavailable",detail:t.lastRepoLoadFailure??"Kiwi could not load repo-local state into the desktop shell.",nextCommand:null,actionLabel:"Reload state"}:e.repoState.mode==="repo-not-initialized"?{tone:"blocked",title:"Repo not initialized",detail:"Kiwi opened the repo, but the repo-local continuity files are not set up yet.",nextCommand:"kc init"}:e.repoState.mode==="initialized-invalid"||e.validation.errors>0||(i=(n=e.kiwiControl)==null?void 0:n.executionPlan)!=null&&i.blocked?{tone:"blocked",title:e.readiness.label,detail:((s=(a=e.runtimeDecision)==null?void 0:a.recovery)==null?void 0:s.reason)??e.readiness.detail,nextCommand:Gt(e)}:e.executionState.lifecycle==="blocked"||e.executionState.lifecycle==="failed"?{tone:((l=(o=e.runtimeDecision)==null?void 0:o.recovery)==null?void 0:l.kind)==="failed"||e.executionState.lifecycle==="failed"?"failed":"blocked",title:e.readiness.label,detail:((p=(d=e.runtimeDecision)==null?void 0:d.recovery)==null?void 0:p.reason)??e.readiness.detail,nextCommand:Gt(e)}:null}function ni(e,t,n){return e==="checkpoint"?{tone:"blocked",title:"Checkpoint unavailable",detail:t,nextCommand:n}:e==="handoff"?{tone:"blocked",title:"Handoff unavailable",detail:t,nextCommand:n}:{tone:"blocked",title:"Run Auto needs a real goal",detail:t,nextCommand:n}}function ii(e){return e?{tone:"blocked",title:"Why it stopped",detail:e.reason,nextCommand:e.fixCommand,followUpCommand:e.retryCommand}:null}function ai(e){return{title:"Kiwi Control failed to start",intro:"The renderer hit an error before it could mount the UI.",steps:["Relaunch Kiwi Control once to confirm the failure is repeatable.","Run `kc ui` from Terminal to check whether the desktop bridge starts cleanly there.","If it still fails, capture the error details below before reporting it."],detail:e}}function Gt(e){var t,n,i,a,s,o,l,d,p,S,r,$;return((n=(t=e.runtimeDecision)==null?void 0:t.recovery)==null?void 0:n.fixCommand)??((i=e.runtimeDecision)==null?void 0:i.nextCommand)??e.executionState.nextCommand??e.readiness.nextCommand??((o=(s=(a=e.kiwiControl)==null?void 0:a.executionPlan)==null?void 0:s.lastError)==null?void 0:o.fixCommand)??((p=(d=(l=e.kiwiControl)==null?void 0:l.executionPlan)==null?void 0:d.lastError)==null?void 0:p.retryCommand)??(($=(r=(S=e.kiwiControl)==null?void 0:S.executionPlan)==null?void 0:r.nextCommands)==null?void 0:$[0])??`kiwi-control validate --target "${e.targetRoot}"`}function si(e){return e==="warm-snapshot"||e==="stale-snapshot"}function Tt(){return document.querySelector("#boot-overlay")}function vn(e,t){const n=Tt();n&&(n.classList.remove("is-hidden"),n.innerHTML=`
    <div class="kc-boot-fallback">
      <div class="kc-boot-card">
        <h1>${Fe(e)}</h1>
        <p>${Fe(t)}</p>
      </div>
    </div>
  `)}function mt(e){const t=Tt();if(!t)return;const n=ai(e);t.classList.remove("is-hidden"),t.innerHTML=`
    <div class="kc-boot-fallback">
      <div class="kc-boot-card">
        <h1>${Fe(n.title)}</h1>
        <p>${Fe(n.intro)}</p>
        <ol>
          ${n.steps.map(i=>`<li>${Fe(i)}</li>`).join("")}
        </ol>
        <pre>${Fe(n.detail)}</pre>
      </div>
    </div>
  `}function oi(){var e;(e=Tt())==null||e.classList.add("is-hidden")}function Fe(e){return e.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;")}window.__KIWI_BOOT_API__={mounted:!1,renderMessage:vn,renderError:mt,hide:oi};vn("Loading Kiwi Control","External boot diagnostics loaded. If this message never changes, the main renderer bundle is failing before mount.");window.addEventListener("error",e=>{var t;(t=window.__KIWI_BOOT_API__)!=null&&t.mounted||mt(e.message||"Unknown startup error")});window.addEventListener("unhandledrejection",e=>{var n;if((n=window.__KIWI_BOOT_API__)!=null&&n.mounted)return;const t=e.reason;mt(typeof t=="string"?t:(t==null?void 0:t.message)??"Unhandled promise rejection")});window.setTimeout(()=>{var e;(e=window.__KIWI_BOOT_API__)!=null&&e.mounted||mt("Renderer timeout: the main UI bundle did not report a successful mount.")},3e3);function ri(e,t=!1){return window.__TAURI_INTERNALS__.transformCallback(e,t)}async function W(e,t={},n){return window.__TAURI_INTERNALS__.invoke(e,t,n)}var Kt;(function(e){e.WINDOW_RESIZED="tauri://resize",e.WINDOW_MOVED="tauri://move",e.WINDOW_CLOSE_REQUESTED="tauri://close-requested",e.WINDOW_DESTROYED="tauri://destroyed",e.WINDOW_FOCUS="tauri://focus",e.WINDOW_BLUR="tauri://blur",e.WINDOW_SCALE_FACTOR_CHANGED="tauri://scale-change",e.WINDOW_THEME_CHANGED="tauri://theme-changed",e.WINDOW_CREATED="tauri://window-created",e.WEBVIEW_CREATED="tauri://webview-created",e.DRAG_ENTER="tauri://drag-enter",e.DRAG_OVER="tauri://drag-over",e.DRAG_DROP="tauri://drag-drop",e.DRAG_LEAVE="tauri://drag-leave"})(Kt||(Kt={}));async function ci(e,t){window.__TAURI_EVENT_PLUGIN_INTERNALS__.unregisterListener(e,t),await W("plugin:event|unlisten",{event:e,eventId:t})}async function Wt(e,t,n){var i;const a=(i=void 0)!==null&&i!==void 0?i:{kind:"Any"};return W("plugin:event|listen",{event:e,target:a,handler:ri(t)}).then(s=>async()=>ci(e,s))}function li(e){const{state:t,decision:n,repoLabel:i,phase:a,validationState:s,themeLabel:o,activeTheme:l,activeMode:d,isLogDrawerOpen:p,isInspectorOpen:S,currentTargetRoot:r,commandState:$,currentTask:b,retryEnabled:u,composerConstraint:f,runtimeInfo:h,loadStatus:I,helpers:N}=e,{escapeHtml:c,escapeAttribute:C,iconSvg:M,formatCliCommand:z,renderHeaderBadge:O,renderHeaderMeta:V}=N,w=!r||$.loading;return`
    <div class="kc-topbar-primary">
      <div class="kc-topbar-left">
        <button class="kc-repo-pill" type="button">
          <span class="kc-repo-name">${c(i)}</span>
          <span class="kc-repo-path">${c(t.targetRoot||"No repo loaded yet")}</span>
        </button>
        ${O(t.repoState.title,t.repoState.mode)}
        ${O(t.projectType,"neutral")}
        ${a!=="none recorded"?O(a,"neutral"):""}
      </div>
      <div class="kc-topbar-center">
        ${V("Next",n.nextAction)}
        ${V("Blocking",n.blockingIssue)}
        ${V("Health",n.systemHealth)}
        ${V("Safe",n.executionSafety)}
        ${V("Changed",n.lastChangedAt)}
        ${V("Failures",String(n.recentFailures))}
        ${V("Warnings",String(n.newWarnings))}
        ${h?V(h.label,h.detail):""}
      </div>
      <div class="kc-topbar-right">
        <div class="kc-inline-badges">
          <button class="kc-tab-button ${d==="execution"?"is-active":""}" type="button" data-ui-mode="execution">Execution</button>
          <button class="kc-tab-button ${d==="inspection"?"is-active":""}" type="button" data-ui-mode="inspection">Inspection</button>
        </div>
        <div class="kc-status-chip">
          <strong>${c(d)}</strong>
          <span>${c(s)}</span>
        </div>
        <button class="kc-theme-toggle" type="button" data-theme-toggle>
          ${M(l==="dark"?"sun":"moon")}
          <span>${c(o)}</span>
        </button>
        <button class="kc-icon-button" type="button" data-toggle-logs>
          ${M(p?"logs-open":"logs-closed")}
        </button>
        <button class="kc-icon-button" type="button" data-toggle-inspector>
          ${M(S?"panel-open":"panel-closed")}
        </button>
      </div>
    </div>
    <div class="kc-topbar-actions">
      <div class="kc-topbar-action-group">
        <button class="kc-secondary-button kc-action-button" type="button" data-ui-command="guide" ${w?"disabled":""}>Guide</button>
        <button class="kc-secondary-button kc-action-button" type="button" data-ui-command="next" ${w?"disabled":""}>Next</button>
        <button class="kc-secondary-button kc-action-button" type="button" data-ui-command="review" ${w?"disabled":""}>Review</button>
        <button class="kc-secondary-button kc-action-button" type="button" data-ui-command="validate" ${w?"disabled":""}>Validate</button>
        <button class="kc-secondary-button kc-action-button" type="button" data-ui-command="retry" ${!u||w?"disabled":""}>Retry</button>
        <button class="kc-secondary-button kc-action-button" type="button" data-ui-command="run-auto" ${w||!b?"disabled":""}>Run Auto</button>
        <button class="kc-secondary-button kc-action-button" type="button" data-ui-command="checkpoint" ${w?"disabled":""}>Checkpoint</button>
        <button class="kc-secondary-button kc-action-button" type="button" data-ui-command="handoff" ${w||t.specialists.handoffTargets.length===0?"disabled":""}>Handoff</button>
      </div>
      ${$.composer?`
          <div class="kc-action-composer">
            <span class="kc-section-micro">${c($.composer)}</span>
            ${$.composer==="handoff"?`<select class="kc-action-input" data-command-draft>
                  ${[...new Set([$.draftValue,...t.specialists.handoffTargets].filter(Boolean))].map(we=>`
                    <option value="${C(we)}" ${we===$.draftValue?"selected":""}>${c(we)}</option>
                  `).join("")}
                </select>`:`<input class="kc-action-input" data-command-draft value="${C($.draftValue)}" placeholder="${C($.composer==="checkpoint"?"checkpoint label":"run description")}" />`}
            <button class="kc-secondary-button kc-action-button is-primary" type="button" data-composer-submit="${$.composer}" ${$.loading||f!=null&&f.blocked?"disabled":""}>Run</button>
            <button class="kc-secondary-button kc-action-button" type="button" data-composer-cancel ${$.loading?"disabled":""}>Cancel</button>
          </div>
          ${f?`<div class="kc-action-hint ${f.blocked?"is-blocked":""}">
                <strong>${c(f.reason)}</strong>
                ${f.nextCommand?`<code class="kc-command-chip">${c(z(f.nextCommand,r))}</code>`:""}
              </div>`:""}
        `:""}
    </div>
    ${I.visible?`
        <div class="kc-load-strip tone-${I.tone}">
          <div class="kc-load-row">
            <span class="kc-load-badge">
              <span class="kc-load-dot"></span>
              ${c(I.label)}
            </span>
            <strong>${c(I.detail)}</strong>
          </div>
          ${I.nextCommand?`<div class="kc-action-hint is-blocked"><code class="kc-command-chip">${c(z(I.nextCommand,r))}</code></div>`:""}
          <div class="kc-load-progress">
            <span class="kc-load-progress-fill" style="width:${I.progress}%"></span>
          </div>
        </div>
      `:""}
  `}function di(e){const{state:t,graph:n,focusedNode:i,graphDepth:a,graphPan:s,graphZoom:o,graphMechanics:l,treeMechanics:d,helpers:p}=e,{escapeHtml:S,escapeAttribute:r,renderHeaderBadge:$,renderPanelHeader:b,renderNoteRow:u,renderEmptyState:f}=p;return`
    <div class="kc-view-shell">
      <section class="kc-view-header">
        <div>
          <p class="kc-view-kicker">Repo Graph</p>
          <h1>Mind Map</h1>
          <p>Repo topology visualized from Kiwi’s context tree with local focus, selection, and impact-path controls.</p>
        </div>
        ${$(n.nodes.length>0?`${n.nodes.length} nodes`:"empty",n.nodes.length>0?"success":"warn")}
      </section>

      <section class="kc-panel">
        <div class="kc-panel-head-row">
          ${b("Graph Overview","Root-centered map of directories and files Kiwi currently knows about.")}
          <div class="kc-inline-badges">
            <button class="kc-secondary-button" type="button" data-graph-action="depth-down">Depth -</button>
            <span class="kc-inline-badge">depth ${a}</span>
            <button class="kc-secondary-button" type="button" data-graph-action="depth-up">Depth +</button>
            <button class="kc-secondary-button" type="button" data-graph-action="reset-view">Reset view</button>
          </div>
        </div>
        ${n.nodes.length>0?`
            <div class="kc-graph-shell">
              <svg class="kc-graph-canvas" data-graph-surface data-graph-canvas-root viewBox="0 0 1200 720" role="img" aria-label="Repo graph">
                <g class="kc-graph-viewport" data-graph-viewport transform="translate(${s.x} ${s.y}) scale(${o})">
                ${n.edges.map(h=>`
                  <line
                    x1="${h.from.x}"
                    y1="${h.from.y}"
                    x2="${h.to.x}"
                    y2="${h.to.y}"
                    data-graph-edge
                    data-from-path="${r(h.fromPath)}"
                    data-to-path="${r(h.toPath)}"
                    class="kc-graph-edge ${h.highlighted?"is-highlighted":""}"
                  />
                `).join("")}
                ${n.nodes.map(h=>`
                  <g
                    transform="translate(${h.x}, ${h.y})"
                    class="kc-graph-node-wrap ${h.highlighted?"is-highlighted":""}"
                    data-graph-node-wrap
                    data-path="${r(h.path)}"
                  >
                    <circle
                      r="${h.radius}"
                      data-graph-node
                      data-path="${r(h.path)}"
                      data-kind="${h.kind}"
                      class="kc-graph-node ${h.tone} importance-${h.importance}"
                    />
                    <text class="kc-graph-label" text-anchor="middle" dy=".35em">${S(h.label)}</text>
                  </g>
                `).join("")}
                </g>
              </svg>
            </div>
          `:f("No graph data is available yet. Run kiwi-control prepare to build a richer context tree.")}
      </section>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${b("Cluster Summary","Top visible nodes from the current context selection tree.")}
          ${n.summary.length>0?`<div class="kc-stack-list">${n.summary.map(h=>u(h.label,h.kind,h.meta)).join("")}</div>`:f("No cluster summary is available yet.")}
        </section>
        <section class="kc-panel">
          ${b("Node Actions",i?`${i.label} · ${i.kind}`:"Select a node to act on it.")}
          ${i?`
              <div class="kc-stack-list">
                ${u("Status",i.status,`importance: ${i.importance}`)}
                ${u("Path",i.kind,i.path)}
                ${u("Project",t.projectType,t.repoState.detail)}
              </div>
              <div class="kc-divider"></div>
              <div class="kc-inline-badges">
                <button class="kc-secondary-button" type="button" data-graph-action="focus" data-path="${r(i.path)}">Focus</button>
                <button class="kc-secondary-button" type="button" data-graph-action="include" data-path="${r(i.path)}">Include</button>
                <button class="kc-secondary-button" type="button" data-graph-action="exclude" data-path="${r(i.path)}">Exclude</button>
                <button class="kc-secondary-button" type="button" data-graph-action="ignore" data-path="${r(i.path)}">Ignore</button>
                ${i.kind==="file"?`<button class="kc-secondary-button" type="button" data-graph-action="open" data-path="${r(i.path)}">Open</button>`:""}
              </div>
            `:f("No graph node is currently selected.")}
        </section>
      </div>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${b("How This Map Is Built","This graph is projected from Kiwi’s current context tree and index signals, not from a full semantic dependency graph.")}
          ${l.length>0?`<div class="kc-stack-list">${l.map(h=>u(h.title,h.metric,h.note)).join("")}</div>`:f("No graph mechanics are available yet.")}
        </section>
        <section class="kc-panel">
          ${b("How Tree Status Works","Selected, candidate, and excluded statuses come from the current tree plus any local UI overrides.")}
          ${d.length>0?`<div class="kc-stack-list">${d.map(h=>u(h.title,h.metric,h.note)).join("")}</div>`:f("No tree mechanics are available yet.")}
        </section>
      </div>
    </div>
  `}function ui(e){const{tree:t,focusedItem:n,contextOverrides:i,helpers:a}=e,{escapeHtml:s,escapeAttribute:o}=a;return`
    <div class="kc-tree-shell">
      <div class="kc-tree-legend">
        <span><strong>✓</strong> selected</span>
        <span><strong>•</strong> candidate</span>
        <span><strong>×</strong> excluded</span>
        <span><strong>local</strong> UI-only until a CLI command runs</span>
      </div>
      <div class="kc-tree-root">
        ${t.nodes.map(l=>bn(l,n,i,a)).join("")}
      </div>
    </div>
  `}function bn(e,t,n,i){const{escapeHtml:a,escapeAttribute:s}=i,o=n.get(e.path),l=o?`override: ${o}`:e.status,d=(t==null?void 0:t.kind)==="path"&&t.path===e.path?"is-focused":"";return e.kind==="file"?`
      <div class="kc-tree-node tree-${a(e.status)} ${d}">
        <span class="kc-tree-row">
          <span class="kc-tree-status">${qt(e.status)}</span>
          <span class="kc-tree-name">${a(e.name)}</span>
          <span class="kc-tree-actions">
            <button class="kc-tree-action" type="button" data-tree-action="focus" data-path="${s(e.path)}">Focus</button>
            <button class="kc-tree-action" type="button" data-tree-action="include" data-path="${s(e.path)}">Include</button>
            <button class="kc-tree-action" type="button" data-tree-action="exclude" data-path="${s(e.path)}">Exclude</button>
            <button class="kc-tree-action" type="button" data-tree-action="ignore" data-path="${s(e.path)}">Ignore</button>
            <button class="kc-tree-action" type="button" data-tree-action="open" data-path="${s(e.path)}">Open</button>
          </span>
        </span>
        <span class="kc-tree-meta">${a(l)}</span>
      </div>
    `:`
    <details class="kc-tree-node tree-dir tree-${a(e.status)} ${d}" ${e.expanded?"open":""}>
      <summary class="kc-tree-row">
        <span class="kc-tree-caret"></span>
        <span class="kc-tree-status">${qt(e.status)}</span>
        <span class="kc-tree-name">${a(e.name)}/</span>
        <span class="kc-tree-actions">
          <button class="kc-tree-action" type="button" data-tree-action="focus" data-path="${s(e.path)}">Focus</button>
          <button class="kc-tree-action" type="button" data-tree-action="include" data-path="${s(e.path)}">Include</button>
          <button class="kc-tree-action" type="button" data-tree-action="exclude" data-path="${s(e.path)}">Exclude</button>
          <button class="kc-tree-action" type="button" data-tree-action="ignore" data-path="${s(e.path)}">Ignore</button>
          <button class="kc-tree-action" type="button" data-tree-action="open" data-path="${s(e.path)}">Open</button>
        </span>
      </summary>
      <div class="kc-tree-meta">${a(l)}</div>
      <div class="kc-tree-children">
        ${e.children.map(p=>bn(p,t,n,i)).join("")}
      </div>
    </details>
  `}function qt(e){switch(e){case"selected":return"✓";case"excluded":return"×";default:return"•"}}function pi(e){var c,C;const{state:t,steps:n,editingPlanStepId:i,editingPlanDraft:a,focusedItem:s,commandState:o,failureGuidance:l,helpers:d}=e,{escapeHtml:p,escapeAttribute:S,formatCliCommand:r,renderPanelHeader:$,renderInlineBadge:b,renderNoteRow:u,renderEmptyState:f,renderHeaderBadge:h}=d,I=(c=t.kiwiControl)==null?void 0:c.executionPlan,N=t.derivedFreshness.find(M=>M.outputName==="execution-plan");return I?`
    <section class="kc-panel">
      ${$("Execution Plan",`${I.summary||"No execution plan is recorded yet."} Compatibility/debug snapshot${(N==null?void 0:N.sourceRevision)!=null?` · revision ${N.sourceRevision}`:""}${N!=null&&N.generatedAt?` · generated ${N.generatedAt}`:""}.`)}
      <div class="kc-inline-badges">
        ${b(`state: ${I.state}`)}
        ${b(`current: ${((C=n[I.currentStepIndex])==null?void 0:C.id)??"none"}`)}
        ${b(`risk: ${I.risk}`)}
        ${I.confidence?b(`confidence: ${I.confidence}`):""}
      </div>
      ${l?`<div class="kc-divider"></div><div class="kc-stack-list">
            ${u("Why it stopped",l.title,l.detail)}
            ${u("Do this now",l.nextCommand?r(l.nextCommand,t.targetRoot):"No fix command recorded","Run this before continuing.")}
            ${u("Then retry",l.followUpCommand?r(l.followUpCommand,t.targetRoot):"No retry command recorded","Use this after the blocking issue is cleared.")}
          </div>`:""}
      ${n.length>0?`<div class="kc-plan-list">${n.map((M,z)=>mi(M,z,i,a,s,o.loading,{escapeHtml:p,escapeAttribute:S,renderHeaderBadge:h})).join("")}</div>`:f("No execution plan is available yet.")}
    </section>
  `:`
      <section class="kc-panel">
        ${$("Execution Plan","No execution plan is recorded yet.")}
        ${f("No execution plan is available yet.")}
      </section>
    `}function mi(e,t,n,i,a,s,o){const{escapeHtml:l,escapeAttribute:d,renderHeaderBadge:p}=o,S=n===e.id,r=(a==null?void 0:a.kind)==="step"&&a.id===e.id;return`
    <article class="kc-plan-step ${e.skipped?"is-skipped":""} ${r?"is-focused":""}" data-step-row="${d(e.id)}">
      <div class="kc-plan-step-head">
        <div>
          <span class="kc-section-micro">step ${t+1}</span>
          ${S?`<input class="kc-action-input kc-plan-edit-input" data-plan-edit-input value="${d(i)}" />`:`<strong>${l(e.displayTitle)}</strong>`}
          <p>${l(e.displayNote??e.command)}</p>
        </div>
        <div class="kc-inline-badges">
          ${p(e.status,e.status==="failed"?"warn":e.status==="success"?"success":"neutral")}
          ${e.skipped?'<span class="kc-inline-badge">skipped</span>':""}
        </div>
      </div>
      <div class="kc-plan-step-actions">
        <button class="kc-secondary-button" type="button" data-plan-action="focus" data-step-id="${d(e.id)}">Focus</button>
        <button class="kc-secondary-button" type="button" data-plan-action="run" data-step-id="${d(e.id)}" ${s?"disabled":""}>Run</button>
        <button class="kc-secondary-button" type="button" data-plan-action="retry" data-step-id="${d(e.id)}" ${s?"disabled":""}>Retry</button>
        <button class="kc-secondary-button" type="button" data-plan-action="skip" data-step-id="${d(e.id)}">${e.skipped?"Unskip":"Skip"}</button>
        ${S?`
            <button class="kc-secondary-button" type="button" data-plan-action="edit-save" data-step-id="${d(e.id)}">Save</button>
            <button class="kc-secondary-button" type="button" data-plan-action="edit-cancel" data-step-id="${d(e.id)}">Cancel</button>
          `:`<button class="kc-secondary-button" type="button" data-plan-action="edit" data-step-id="${d(e.id)}">Edit</button>`}
        <button class="kc-secondary-button" type="button" data-plan-action="move-up" data-step-id="${d(e.id)}">↑</button>
        <button class="kc-secondary-button" type="button" data-plan-action="move-down" data-step-id="${d(e.id)}">↓</button>
      </div>
      <div class="kc-plan-step-meta">
        <code class="kc-command-chip">${l(e.command)}</code>
        <span>${l(e.validation)}</span>
        ${e.retryCommand?`<span>${l(e.retryCommand)}</span>`:""}
      </div>
    </article>
  `}function hi(e){var z,O,V;const{state:t,primaryAction:n,activeSpecialist:i,topCapability:a,signalItems:s,focusedItem:o,focusedLabel:l,focusedReason:d,marker:p,activeMode:S,commandState:r,helpers:$}=e,{escapeHtml:b,renderInlineBadge:u,renderExplainabilityBadge:f,renderGateRow:h,renderBulletRow:I,renderNoteRow:N,deriveSignalImpact:c}=$,C=t.kiwiControl,M=t.derivedFreshness.find(w=>w.outputName==="runtime-lifecycle");return C?`
    <div class="kc-inspector-shell">
      <div class="kc-inspector-header">
        <div>
          <span>Inspector</span>
          <h2>${b(l)}</h2>
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
        ${N("Selection",(o==null?void 0:o.kind)??"global",d)}
        ${N("Decision",p,o?"Local inspector review state for the current focus.":"Select a node or plan step to review it here.")}
      </section>

      <section class="kc-inspector-section">
        <p class="kc-section-micro">Reasoning</p>
        <p>${b(d)}</p>
        <div class="kc-inline-badges">
          ${u(((z=C.contextView.confidence)==null?void 0:z.toUpperCase())??"UNKNOWN")}
          ${u(C.contextView.confidenceDetail??"No confidence detail")}
          ${f("heuristic",C.contextTrace.honesty.heuristic)}
          ${f("low confidence",C.contextTrace.honesty.lowConfidence)}
          ${f("partial scan",C.contextTrace.honesty.partialScan||C.tokenBreakdown.partialScan||C.indexing.partialScan)}
        </div>
      </section>

      <section class="kc-inspector-section">
        <p class="kc-section-micro">Decision inputs</p>
        ${s.length>0?`<div class="kc-stack-list">${s.map(w=>N(w,"impact",c(w))).join("")}</div>`:"<p>No decision inputs are currently surfaced.</p>"}
      </section>

      <section class="kc-inspector-section">
        <p class="kc-section-micro">Lifecycle</p>
        <div class="kc-gate-list">
          ${h("Stage",C.runtimeLifecycle.currentStage,"default")}
          ${h("Validation",C.runtimeLifecycle.validationStatus??"unknown",C.runtimeLifecycle.validationStatus==="error"?"warn":"default")}
        </div>
        <p>${b(C.runtimeLifecycle.nextRecommendedAction??"No runtime lifecycle recommendation is recorded yet.")}</p>
        <p>${b(`Compatibility/debug snapshot${(M==null?void 0:M.sourceRevision)!=null?` · revision ${M.sourceRevision}`:""}${M!=null&&M.generatedAt?` · generated ${M.generatedAt}`:""}.`)}</p>
      </section>

      <section class="kc-inspector-section">
        <p class="kc-section-micro">Token estimate</p>
        <div class="kc-gate-list">
          ${h("Measured",C.measuredUsage.available?C.measuredUsage.totalTokens.toLocaleString("en-US"):"none",C.measuredUsage.available?"success":"default")}
          ${h("Selected",`~${C.tokenAnalytics.selectedTokens.toLocaleString("en-US")}`,"default")}
          ${h("Full repo",`~${C.tokenAnalytics.fullRepoTokens.toLocaleString("en-US")}`,"default")}
          ${h("Saved",`~${C.tokenAnalytics.savingsPercent}%`,"success")}
        </div>
        <p>${b(C.measuredUsage.available?C.measuredUsage.note:C.tokenAnalytics.estimateNote??"No repo-local token estimate is available yet.")}</p>
      </section>

      ${S==="inspection"?`
          <section class="kc-inspector-section">
            <p class="kc-section-micro">MCP usage</p>
            <div class="kc-gate-list">
              ${h("Pack",((O=t.mcpPacks.selectedPack)==null?void 0:O.name)??((V=t.mcpPacks.selectedPack)==null?void 0:V.id)??t.mcpPacks.suggestedPack.name??t.mcpPacks.suggestedPack.id,"default")}
              ${h("Compatible",String(t.mcpPacks.compatibleCapabilities.length),t.mcpPacks.compatibleCapabilities.length>0?"success":"warn")}
              ${h("Top capability",(a==null?void 0:a.id)??"none",a?"success":"warn")}
            </div>
            <p>${b(t.mcpPacks.note)}</p>
          </section>

          <section class="kc-inspector-section">
            <p class="kc-section-micro">Specialist usage</p>
            <div class="kc-gate-list">
              ${h("Active",(i==null?void 0:i.name)??t.specialists.activeSpecialist,"default")}
              ${h("Risk",(i==null?void 0:i.riskPosture)??"unknown",(i==null?void 0:i.riskPosture)==="conservative"?"success":"default")}
              ${h("Tool fit",((i==null?void 0:i.preferredTools)??[]).join(", ")||"none","default")}
            </div>
            <p>${b((i==null?void 0:i.purpose)??t.specialists.safeParallelHint)}</p>
          </section>

          <section class="kc-inspector-section">
            <p class="kc-section-micro">Skills & trace</p>
            ${C.skills.activeSkills.length>0?`<div class="kc-stack-list">${C.skills.activeSkills.slice(0,3).map(w=>I(`${w.name} — ${w.executionTemplate[0]??w.description}`)).join("")}</div>`:"<p>No active skills are currently matched.</p>"}
          </section>
        `:""}

      <section class="kc-inspector-section">
        <p class="kc-section-micro">Command</p>
        ${r.lastResult?`<code class="kc-command-block">${b(r.lastResult.commandLabel)}</code>`:n!=null&&n.command?`<code class="kc-command-block">${b(n.command)}</code>`:"<p>No command recorded for the current state.</p>"}
      </section>
    </div>
  `:`
      <div class="kc-inspector-shell">
        <div class="kc-inspector-header">
          <div>
            <span>Inspector</span>
            <h2>${b(l)}</h2>
          </div>
          <button class="kc-icon-button" type="button" data-toggle-inspector>×</button>
        </div>
        <section class="kc-inspector-section">
          <p class="kc-section-micro">Reasoning</p>
          <p>${b(d)}</p>
        </section>
      </div>
    `}function fi(e,t){var r,$,b,u,f,h,I,N;const n=e.kiwiControl,i=((r=n==null?void 0:n.nextActions.actions[0])==null?void 0:r.action)??e.repoState.title,a=((b=($=e.runtimeDecision)==null?void 0:$.recovery)==null?void 0:b.reason)??((u=n==null?void 0:n.executionPlan.lastError)==null?void 0:u.reason)??(e.validation.errors>0?`${e.validation.errors} validation error${e.validation.errors===1?"":"s"}`:"none"),s=((n==null?void 0:n.execution.recentExecutions.filter(c=>!c.success).length)??0)+((n==null?void 0:n.workflow.steps.filter(c=>c.status==="failed").length)??0),o=e.validation.warnings+e.machineAdvisory.systemHealth.warningCount,l=e.validation.errors>0||e.machineAdvisory.systemHealth.criticalCount>0?"blocked":o>0?"attention":"healthy",d=t.isLoadingRepoState?"loading":t.isRefreshingFreshRepoState||t.hasWarmSnapshot?"guarded":l==="blocked"?"blocked":(n==null?void 0:n.contextView.confidence)==="low"||n!=null&&n.indexing.partialScan?"guarded":"ready",p=[(f=n==null?void 0:n.execution.recentExecutions[0])==null?void 0:f.timestamp,(h=n==null?void 0:n.runtimeLifecycle.recentEvents[0])==null?void 0:h.timestamp,(I=n==null?void 0:n.feedback.recentEntries[0])==null?void 0:I.timestamp].filter(c=>!!c),S=p.length>0?t.formatTimestamp(((N=p.map(c=>new Date(c)).sort((c,C)=>C.getTime()-c.getTime())[0])==null?void 0:N.toISOString())??""):"unknown";return{nextAction:i,blockingIssue:a,systemHealth:l,executionSafety:d,lastChangedAt:S,recentFailures:s,newWarnings:o}}function gi(e){const t=[{label:"Planning",score:e.optimizationScore.planning.score,missingSignals:e.optimizationScore.planning.missingSignals},{label:"Execution",score:e.optimizationScore.execution.score,missingSignals:e.optimizationScore.execution.missingSignals},{label:"Assistant",score:e.optimizationScore.assistant.score,missingSignals:e.optimizationScore.assistant.missingSignals}],n=[...t].sort((d,p)=>p.score-d.score)[0],i=[...t].sort((d,p)=>d.score-p.score)[0],a=e.guidance.find(d=>d.priority==="critical")??e.guidance.find(d=>d.priority==="recommended")??null,s=(a==null?void 0:a.fixCommand)??(a==null?void 0:a.hintCommand)??"Run kiwi-control usage",o=(a==null?void 0:a.message)??i.missingSignals[0]??"No major machine gaps detected.",l=e.systemHealth.criticalCount===0&&e.optimizationScore.planning.score>=70&&e.optimizationScore.execution.score>=70?"ready":"needs work";return{overallStatus:l,overallTone:l==="ready"?"success":"warn",title:l==="ready"?"Setup looks ready":"Setup needs work",detail:l==="ready"?"Heuristic completeness looks strong across the primary runtimes.":"Heuristic completeness still shows at least one meaningful machine gap.",bestHeuristicLabel:`${n.label} heuristic`,bestHeuristicValue:`${n.score}%`,strongestGapLabel:a?"Strongest gap":`${i.label} gap`,strongestGapDetail:o,nextFixLabel:"Next recommended fix",nextFixCommand:s}}function ki(e){const t=e.state.kiwiControl,n=t.nextActions.actions[0]??null,i=e.state.specialists.activeProfile,a=e.state.mcpPacks.compatibleCapabilities[0]??null,s=t.decisionLogic.inputSignals.slice(0,e.activeMode==="execution"?3:5),o=e.resolveFocusedStep(e.focusedItem),l=e.resolveFocusedNode(e.focusedItem),d=(o==null?void 0:o.displayTitle)??(l==null?void 0:l.name)??(n==null?void 0:n.action)??"No blocking action",p=(o==null?void 0:o.displayNote)??(l==null?void 0:l.path)??(n==null?void 0:n.reason)??t.nextActions.summary??e.state.repoState.detail;return{state:e.state,primaryAction:n,activeSpecialist:i,topCapability:a,signalItems:s,focusedStep:o,focusedNode:l,focusedItem:e.focusedItem,focusedLabel:d,focusedReason:p,marker:e.marker,activeMode:e.activeMode,commandState:e.commandState}}function vi(e){const{state:t,activeMode:n,helpers:i}=e,{escapeHtml:a,escapeAttribute:s,iconSvg:o,iconLabel:l,renderHeaderBadge:d,renderPanelHeader:p,renderInlineBadge:S,renderNoteRow:r,renderEmptyState:$,renderStatCard:b,renderInfoRow:u,formatInteger:f,formatPercent:h,formatCurrency:I,formatTimestamp:N}=i,c=t.machineAdvisory,C=gi(c),M={critical:c.guidance.filter(k=>k.group==="critical-issues"),recommended:c.guidance.filter(k=>k.group==="improvements"),optional:c.guidance.filter(k=>k.group==="optional-optimizations")},z=(k,X)=>`
    <div class="kc-table-shell">
      <table class="kc-data-table">
        <thead>
          <tr>${k.map(xe=>`<th>${a(xe)}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${X.map(xe=>`<tr>${xe.map(ei=>`<td>${ei}</td>`).join("")}</tr>`).join("")}
        </tbody>
      </table>
    </div>
  `,O=(k,X,xe)=>`<span class="kc-machine-state ${k?"is-active":"is-inactive"}">${a(k?X:xe)}</span>`,V=k=>`
    <div class="kc-inline-badges kc-machine-freshness">
      ${d(k.status,k.status==="fresh"?"success":k.status==="cached"?"neutral":"warn")}
      ${S(k.updatedAt?N(k.updatedAt):"unknown time")}
      ${k.reason?S(k.reason):""}
    </div>
  `,w=k=>`${k.status}${k.updatedAt?` · ${N(k.updatedAt)}`:""}${k.reason?` · ${k.reason}`:""}`,we=k=>{const X=[k.fixCommand,k.hintCommand].filter(Boolean).join(" | ");return`
      <div class="kc-note-row">
        <div>
          <strong>${a(k.message)}</strong>
          <span>${a(k.reason??`section: ${k.section}`)}</span>
          <span>${a(k.impact)}</span>
        </div>
        <em class="${k.priority==="critical"?"tone-warn":""}">${a(X||k.priority)}</em>
      </div>
    `},kt=(k,X)=>`
    <div class="kc-stack-block">
      <p class="kc-stack-label">${a(k)}</p>
      <div class="kc-stack-list">
        ${X.map(xe=>we(xe)).join("")}
      </div>
    </div>
  `;return`
    <div class="kc-view-shell">
      <section class="kc-view-header">
        <div>
          <p class="kc-view-kicker">Machine Advisory</p>
          <h1>System Limitations</h1>
          <p>Read-only machine limitations and repair guidance. This never overrides repo-local Kiwi state. Generated by ${a(c.generatedBy)}.</p>
        </div>
        ${d(c.stale?"stale":"fresh",c.stale?"warn":"success")}
      </section>

      <section class="kc-panel kc-panel-primary" data-render-section="machine-setup-readiness">
        <div class="kc-panel-heading">
          <div class="kc-panel-kicker">
            ${l(o("system"),"Setup Readiness")}
            ${d(C.overallStatus,C.overallTone==="success"?"success":"warn")}
          </div>
          <h1>${a(C.title)}</h1>
          <p>${a(C.detail)}</p>
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
              ${r(C.nextFixLabel,C.nextFixCommand,"Run this next to improve machine readiness or inspect the remaining gap.")}
            </div>
          </section>
        </div>
      </section>

      <div class="kc-stat-grid">
        ${b("Critical",String(c.systemHealth.criticalCount),"fix first",c.systemHealth.criticalCount>0?"critical":"neutral")}
        ${b("Warnings",String(c.systemHealth.warningCount),"recommended actions",c.systemHealth.warningCount>0?"warn":"neutral")}
        ${b("Healthy",String(c.systemHealth.okCount),"healthy checks","success")}
        ${b("Planning Heuristic",`${c.optimizationScore.planning.score}%`,`${c.optimizationScore.planning.earnedPoints}/${c.optimizationScore.planning.maxPoints} signal points`,"neutral")}
        ${b("Execution Heuristic",`${c.optimizationScore.execution.score}%`,`${c.optimizationScore.execution.earnedPoints}/${c.optimizationScore.execution.maxPoints} signal points`,"neutral")}
        ${b("Assistant Heuristic",`${c.optimizationScore.assistant.score}%`,`${c.optimizationScore.assistant.earnedPoints}/${c.optimizationScore.assistant.maxPoints} signal points`,"neutral")}
        ${b("Claude MCPs",String(c.mcpInventory.claudeTotal),"configured servers","neutral")}
        ${b("Codex MCPs",String(c.mcpInventory.codexTotal),"configured servers","neutral")}
        ${b("Copilot MCPs",String(c.mcpInventory.copilotTotal),"configured servers","neutral")}
        ${b("Skills",String(c.skillsCount),"agent skills in ~/.agents/skills","neutral")}
        ${b("Window",`${c.windowDays} days`,c.note,c.stale?"warn":"success")}
      </div>

      <section class="kc-panel">
        ${p("Top Signals","Machine-level limits that matter first for the current repo and workflow state.")}
        <div class="kc-stack-list">
          ${r("Critical issues",String(c.systemHealth.criticalCount),c.systemHealth.criticalCount>0?"Fix these before relying on machine hints.":"No critical machine blockers are currently active.")}
          ${r("Warnings",String(c.systemHealth.warningCount),c.systemHealth.warningCount>0?"Recommended improvements are available.":"No active advisory warnings right now.")}
          ${r("Usage window",`${c.windowDays} days`,c.usage.codex.available||c.usage.claude.available?"Recent machine telemetry is available.":"Token tracking is currently limited.")}
        </div>
      </section>

      <section class="kc-panel">
        ${p("Setup Summary","Borrowed from ai-setup-style machine completion checks, but kept repo-local and read-only.")}
        <div class="kc-two-column">
          <section class="kc-subpanel">
            <div class="kc-stack-list">
              ${r("Installed tools",`${c.setupSummary.installedTools.readyCount}/${c.setupSummary.installedTools.totalCount}`,"Machine-local toolchain presence across the tracked inventory.")}
              ${r("Healthy configs",`${c.setupSummary.healthyConfigs.readyCount}/${c.setupSummary.healthyConfigs.totalCount}`,"Validated config and hook surfaces across Claude, Codex, and Copilot.")}
              ${r("Active token layers",String(c.setupSummary.activeTokenLayers.length),c.setupSummary.activeTokenLayers.length>0?c.setupSummary.activeTokenLayers.join(", "):"No token-optimization layers are currently active.")}
            </div>
          </section>
          <section class="kc-subpanel">
            <div class="kc-stack-list">
              ${r("Planning runtime",c.setupSummary.readyRuntimes.planning?"ready":"needs work",c.optimizationScore.planning.activeSignals.join(", ")||"No active planning signals detected.")}
              ${r("Execution runtime",c.setupSummary.readyRuntimes.execution?"ready":"needs work",c.optimizationScore.execution.activeSignals.join(", ")||"No active execution signals detected.")}
              ${r("Assistant runtime",c.setupSummary.readyRuntimes.assistant?"ready":"needs work",c.optimizationScore.assistant.activeSignals.join(", ")||"No active assistant signals detected.")}
            </div>
          </section>
        </div>
      </section>

      <section class="kc-panel">
        ${p("Optimization Heuristic","Heuristic completeness score calculated from inspected machine signals. This is advisory only and never overrides repo-local Kiwi state.")}
        <div class="kc-two-column">
          <section class="kc-subpanel">
            <div class="kc-stack-list">
              ${r("Planning",`${c.optimizationScore.planning.score}%`,`${c.optimizationScore.planning.earnedPoints}/${c.optimizationScore.planning.maxPoints} points · active: ${c.optimizationScore.planning.activeSignals.join(", ")||"none"}`)}
              ${r("Execution",`${c.optimizationScore.execution.score}%`,`${c.optimizationScore.execution.earnedPoints}/${c.optimizationScore.execution.maxPoints} points · active: ${c.optimizationScore.execution.activeSignals.join(", ")||"none"}`)}
              ${r("Assistant",`${c.optimizationScore.assistant.score}%`,`${c.optimizationScore.assistant.earnedPoints}/${c.optimizationScore.assistant.maxPoints} points · active: ${c.optimizationScore.assistant.activeSignals.join(", ")||"none"}`)}
            </div>
          </section>
          <section class="kc-subpanel">
            <div class="kc-stack-list">
              ${r("Planning gaps",String(c.optimizationScore.planning.missingSignals.length),c.optimizationScore.planning.missingSignals.join(", ")||"No planning gaps detected.")}
              ${r("Execution gaps",String(c.optimizationScore.execution.missingSignals.length),c.optimizationScore.execution.missingSignals.join(", ")||"No execution gaps detected.")}
              ${r("Assistant gaps",String(c.optimizationScore.assistant.missingSignals.length),c.optimizationScore.assistant.missingSignals.join(", ")||"No assistant gaps detected.")}
            </div>
          </section>
        </div>
      </section>

      <section class="kc-panel">
        ${p("Machine Setup Provenance","Structured provenance of the machine-local setup, grouped by phase.")}
        ${V(c.sections.setupPhases)}
        ${c.setupPhases.length>0?c.setupPhases.map(k=>`
              <div class="kc-stack-block">
                <p class="kc-stack-label">${a(k.phase)}</p>
                <div class="kc-stack-list">
                  ${k.items.map(X=>r(tt(X.name),X.active?"active":"inactive",`${bi(X.name,X.description)} · ${$i(X.location)}`)).join("")}
                </div>
              </div>
            `).join('<div class="kc-divider"></div>'):$("No machine-local setup provenance is available.")}
      </section>

      <section class="kc-panel">
        ${p("Config Health","Machine-level config and hook surfaces.")}
        ${V(c.sections.configHealth)}
        ${c.configHealth.length>0?z(["Config","Status","Description"],c.configHealth.map(k=>[a(k.path),O(k.healthy,"healthy","issue"),a(k.description)])):$("No config health data is available.")}
      </section>

      <section class="kc-panel">
        ${p(`Token Usage (Last ${c.windowDays} Days)`,"Measured usage from Claude and Codex local sources.")}
        ${V(c.sections.usage)}
        <div class="kc-two-column">
          <section class="kc-subpanel">
            ${p("Claude Code (via ccusage)",c.usage.claude.note)}
            <div class="kc-stack-list">
              ${r("Total",c.usage.claude.available?`${f(c.usage.claude.totals.totalTokens)} tokens`:"unavailable",c.usage.claude.totals.totalCost!=null?`cache ${h(c.usage.claude.totals.cacheHitRatio)} · cost ${I(c.usage.claude.totals.totalCost)}`:c.usage.claude.note)}
            </div>
            <div class="kc-divider"></div>
            ${c.usage.claude.days.length>0?z(["Date","Input","Output","Cache Read","Cost","Models"],c.usage.claude.days.map(k=>[a(k.date),a(f(k.inputTokens)),a(f(k.outputTokens)),a(f(k.cacheReadTokens)),a(I(k.totalCost)),a(k.modelsUsed.join(", ")||"—")])):$(c.usage.claude.note)}
          </section>
          <section class="kc-subpanel">
            ${p("Codex (via session logs)",c.usage.codex.note)}
            <div class="kc-stack-list">
              ${r("Total",c.usage.codex.available?`${f(c.usage.codex.totals.totalTokens)} tokens`:"unavailable",c.usage.codex.available?`cache ${h(c.usage.codex.totals.cacheHitRatio)} · sessions ${f(c.usage.codex.totals.sessions)}`:c.usage.codex.note)}
            </div>
            <div class="kc-divider"></div>
            ${c.usage.codex.days.length>0?z(["Date","Input","Output","Cached","Sessions"],c.usage.codex.days.map(k=>[a(k.date),a(f(k.inputTokens)),a(f(k.outputTokens)),a(f(k.cachedInputTokens)),a(f(k.sessions))])):$(c.usage.codex.note)}
          </section>
        </div>
        <div class="kc-divider"></div>
        <div class="kc-stack-list">
          ${r("Copilot CLI",c.usage.copilot.available?"available":"unavailable",c.usage.copilot.note)}
        </div>
      </section>

      <section class="kc-panel">
        ${p("Guidance","Assistive machine-local suggestions and repo hints. These are advisory only and never auto-applied.")}
        ${V(c.sections.guidance)}
        ${c.guidance.length>0?`
            ${M.critical.length>0?kt("Critical Issues",M.critical):""}
            ${M.recommended.length>0?kt("Improvements",M.recommended):""}
            ${M.optional.length>0?kt("Optional Optimizations",M.optional):""}
          `:$("No machine-local suggestions are currently recorded.")}
      </section>

      <section class="kc-panel">
        ${p("System Details","Expanded machine diagnostics for inspection mode.")}
        ${n==="inspection"?`
            <details class="kc-fold-card" open>
              <summary><strong>Toolchain inventory</strong><span>${a(w(c.sections.inventory))}</span></summary>
              <div class="kc-fold-body">
                ${c.inventory.length>0?z(["Tool","Version","Phase","Status"],c.inventory.map(k=>[a(tt(k.name)),a(k.version),a(k.phase),O(k.installed,"installed","missing")])):$("No machine-local tool inventory is available.")}
              </div>
            </details>
            <details class="kc-fold-card">
              <summary><strong>MCP servers</strong><span>${a(w(c.sections.mcpInventory))}</span></summary>
              <div class="kc-fold-body">
                <div class="kc-info-grid">
                  ${u("Planning runtime",f(c.mcpInventory.claudeTotal))}
                  ${u("Execution runtime",f(c.mcpInventory.codexTotal))}
                  ${u("Assistant runtime",f(c.mcpInventory.copilotTotal))}
                </div>
                <div class="kc-divider"></div>
                ${c.mcpInventory.tokenServers.length>0?z(["Server","Planning","Execution","Assistant"],c.mcpInventory.tokenServers.map(k=>[a(tt(k.name)),O(k.claude,"active","—"),O(k.codex,"active","—"),O(k.copilot,"active","—")])):$("No token-focused MCP inventory is available.")}
              </div>
            </details>
            <details class="kc-fold-card">
              <summary><strong>Optimization layers</strong><span>${a(w(c.sections.optimizationLayers))}</span></summary>
              <div class="kc-fold-body">
                ${c.optimizationLayers.length>0?z(["Layer","Savings","Planning","Execution","Assistant"],c.optimizationLayers.map(k=>[a(tt(k.name)),a(k.savings),O(k.claude,"yes","no"),O(k.codex,"yes","no"),O(k.copilot,"yes","no")])):$("No optimization layer data is available.")}
              </div>
            </details>
            <details class="kc-fold-card">
              <summary><strong>Config health</strong><span>${a(w(c.sections.configHealth))}</span></summary>
              <div class="kc-fold-body">
                ${c.configHealth.length>0?z(["Config","Status","Description"],c.configHealth.map(k=>[a(k.path),O(k.healthy,"healthy","issue"),a(k.description)])):$("No config health data is available.")}
              </div>
            </details>
          `:$("Switch to inspection mode to expand raw machine internals.")}
      </section>
    </div>
  `}function tt(e){const t=e.trim().toLowerCase();return t==="code-review-graph"?"Structural repo graph":t==="omc"?"Planning orchestration layer":t==="omx"?"Execution orchestration layer":t==="lean-ctx"?"Shell compression layer":t==="context-mode"?"Sandboxed context layer":t==="ccusage"?"Usage telemetry collector":t==="copilot"?"Assistant CLI":t==="ai-setup script"?"Machine bootstrap helper":t.startsWith("copilot plugins")?e.replace(/copilot plugins/i,"Assistant plugins"):e.replace(/[-_]/g," ")}function bi(e,t){const n=e.trim().toLowerCase();return n==="code-review-graph"?"Structural repo search and graph-backed code lookup":n==="omc"?"Multi-agent planning and review orchestration":n==="omx"?"Multi-agent execution orchestration":n==="lean-ctx"?"Shell output compression for lower-noise local runs":n==="context-mode"?"Sandboxed tool output and context shaping":n==="ccusage"?"Machine-local usage telemetry source":n==="copilot"?"Editor assistant command-line surface":n==="ai-setup script"?"Machine bootstrap entrypoint":t}function $i(e){return e.replace(/Claude Code/gi,"planning runtime").replace(/Codex/gi,"execution runtime").replace(/Copilot CLI/gi,"assistant runtime").replace(/~\/\.copilot/gi,"~/.assistant").replace(/~\/\.claude/gi,"~/.planner").replace(/~\/\.codex/gi,"~/.execution")}function yi(e){var S;const{runtimeInfo:t,targetRoot:n,repoMode:i}=e;if(!(!n||i==="repo-not-initialized"||(t==null?void 0:t.runtimeMode)==="installed-user"&&!t.cli.installed))return null;const s=[];n||s.push({id:"choose-repo",label:"Choose Repo",detail:"Pick the folder you want Kiwi Control to open and inspect."}),(t==null?void 0:t.runtimeMode)==="installed-user"&&t.cli.bundledInstallerAvailable&&!t.cli.installed&&s.push({id:"install-cli",label:"Install kc",detail:`Install ${t.cli.installBinDir} into your normal user flow so Terminal can run kc.`}),n&&i==="repo-not-initialized"&&s.push({id:"init-repo",label:"Initialize Repo",detail:"Create the repo-local Kiwi control files for this folder without leaving the app."});const o=t?`${xi(t.runtimeMode)} · ${Si(t.buildSource)} · v${t.appVersion}`:"Desktop shell is running, but runtime details are still loading.",l=t!=null&&t.cli.installed?`Installed at ${t.cli.installedCommandPath??t.cli.installBinDir}`:(t==null?void 0:t.runtimeMode)==="installed-user"?"Not installed yet. Kiwi can install kc from the app.":"Source/developer mode detected. Use the source CLI or install the beta CLI separately if needed.",d=n?i==="repo-not-initialized"?`${n} needs repo-local initialization before normal work begins.`:`${n} is open in Kiwi Control.`:"No repo is open yet.",p=((S=s[0])==null?void 0:S.detail)??"Repo, CLI, and desktop setup are already aligned.";return{title:"Get Kiwi Ready",intro:"Kiwi stays repo-local. This first-run flow makes the installed desktop and kc CLI behave like one product without a manual terminal setup dance.",desktopStatus:o,cliStatus:l,repoStatus:d,nextAction:p,actions:s,note:(t==null?void 0:t.runtimeMode)==="installed-user"?"During beta, kc installed from the desktop depends on the Kiwi Control desktop app remaining installed.":"Developer/source mode keeps the source checkout in control of desktop launching."}}function wi(e,t){const{escapeHtml:n,renderPanelHeader:i,renderNoteRow:a}=t;return`
    <section class="kc-panel kc-panel-primary" data-render-section="onboarding">
      ${i(e.title,e.intro)}
      <div class="kc-two-column">
        <section class="kc-subpanel">
          <div class="kc-stack-list">
            ${a("Desktop","Status",e.desktopStatus)}
            ${a("CLI","Status",e.cliStatus)}
            ${a("Repo","Status",e.repoStatus)}
            ${a("Next","Action",e.nextAction)}
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
                `).join(""):a("Ready","No setup steps left",e.note)}
          </div>
        </section>
      </div>
      <p class="kc-section-note">${n(e.note)}</p>
    </section>
  `}function xi(e){return e==="installed-user"?"Installed user mode":"Developer source mode"}function Si(e){switch(e){case"installed-bundle":return"installed app";case"source-bundle":return"source bundle";default:return"fallback launcher"}}const Ci=new Set(["plan","next","retry","resume","guide","review","prepare","validate","explain","trace","doctor","eval","init","status","check","sync","checkpoint","handoff","run","ui","dispatch","fanout","collect","reconcile","push-check"]);function _(e,t){const n=e==null?void 0:e.trim();if(!n)return"";const i=Ii(n);if(i.length===0)return n;const[a="",s=""]=i;if(!["kiwi-control","kc","shrey-junior","sj"].includes(a))return n;const o=["kc",...i.slice(1)];return!t||t.trim().length===0||!Ci.has(s)||i.includes("--target")?o.map(Yt).join(" "):[...o,"--target",t].map(Yt).join(" ")}function Ri(e){const t=e.repoMode==="repo-not-initialized"?"kc init":"kc sync --dry-run --diff-summary";return[{command:"kc help",label:"Full CLI help",detail:"Show the full Kiwi Control command surface and examples."},{command:_("kc guide",e.targetRoot),label:"Guide this repo",detail:"Show the current goal, step, and next recommended action for the loaded repo."},{command:_("kc status",e.targetRoot),label:"Inspect repo state",detail:"See repo health, next actions, and continuity state."},{command:_(t,e.targetRoot),label:e.repoMode==="repo-not-initialized"?"Initialize repo control":"Preview repo repair",detail:e.repoMode==="repo-not-initialized"?"Set up the repo-local continuity files Kiwi needs.":"Preview repo-local contract writes before applying sync."},{command:_("kc validate",e.targetRoot),label:"Validate repo contract",detail:"Check repo-local validation state before checkpoint, handoff, or execution."},{command:_("kc review",e.targetRoot),label:"Review current changes",detail:"Write the local review pack for the current diff with ranked risk and validation gaps."},{command:_("kc ui",e.targetRoot),label:"Reopen desktop",detail:"Open this exact repo in Kiwi Control again from Terminal."}]}function Ti(e){return e.slice(0,6).map(t=>({title:t.file,metric:t.dependencyChain&&t.dependencyChain.length>1?"selected · chained":"selected",note:[t.selectionWhy??t.reasons.join(", "),t.dependencyChain&&t.dependencyChain.length>1?`chain: ${t.dependencyChain.join(" -> ")}`:null].filter(Boolean).join(" · ")}))}function Pi(e){var t,n,i;return[(t=e.recoveryGuidance)!=null&&t.nextCommand?{command:_(e.recoveryGuidance.nextCommand,e.targetRoot),label:e.recoveryGuidance.title,detail:e.recoveryGuidance.detail}:null,(n=e.executionPlan.lastError)!=null&&n.fixCommand?{command:_(e.executionPlan.lastError.fixCommand,e.targetRoot),label:"Fix the blocking issue",detail:e.executionPlan.lastError.reason}:null,(i=e.executionPlan.lastError)!=null&&i.retryCommand?{command:_(e.executionPlan.lastError.retryCommand,e.targetRoot),label:"Then retry",detail:"Use this after the blocking issue is cleared."}:null,...e.executionPlan.nextCommands.slice(0,3).map((a,s)=>({command:_(a,e.targetRoot),label:s===0?"Next planned command":`Next planned command ${s+1}`,detail:"Derived from the current execution plan without running another CLI command."}))].filter(a=>!!a).filter((a,s,o)=>o.findIndex(l=>l.command===a.command)===s)}function Ai(e){var s,o,l,d,p,S,r;if(!e.executionPlan.blocked&&((s=e.recoveryGuidance)==null?void 0:s.tone)!=="blocked")return[];const t=[],n=new Set,i=e.executionPlan.steps.find($=>$.status==="failed")??e.executionPlan.steps[e.executionPlan.currentStepIndex]??null,a=($,b,u)=>{const f=_(b,e.targetRoot);!f||n.has(f)||(n.add(f),t.push({title:$,command:f,detail:u}))};a(Li((o=e.executionPlan.lastError)==null?void 0:o.fixCommand),((l=e.executionPlan.lastError)==null?void 0:l.fixCommand)??((d=e.recoveryGuidance)==null?void 0:d.nextCommand),((p=e.executionPlan.lastError)==null?void 0:p.reason)??((S=e.recoveryGuidance)==null?void 0:S.detail)??"Review the current workflow blocker before changing repo-local state."),i&&a(i.status==="failed"?`Re-run ${i.id}`:`Run ${i.id}`,i.command,i.validation||"Run the blocked workflow step again after reviewing the blocker."),a("Then retry",(r=e.executionPlan.lastError)==null?void 0:r.retryCommand,"Use this after the blocking issue is cleared.");for(const[$,b]of e.executionPlan.nextCommands.entries())a($===0?"Continue with the next planned step":`Continue with planned step ${$+1}`,b,"Resume the remaining workflow once the blocker is resolved.");return t.slice(0,4)}function Li(e){return e?/\bprepare\b/i.test(e)?"Refresh the prepared scope":/\bdoctor\b/i.test(e)?"Check the environment":/\bexplain\b/i.test(e)?"Inspect the blocker":"Fix the blocking issue":"Inspect the blocker"}function Ii(e){return[...e.matchAll(/"([^"]*)"|'([^']*)'|`([^`]*)`|([^\s]+)/g)].map(n=>n[1]??n[2]??n[3]??n[4]??"").filter(Boolean)}function Yt(e){return/^[A-Za-z0-9_./:@%+=,-]+$/.test(e)?e:`"${e.replace(/(["\\$`])/g,"\\$1")}"`}function $n(e,t){var n,i,a,s,o,l;return t.commandState.loading?{phase:"refreshing",visible:!0,label:"Running command",detail:t.commandState.activeCommand?`Executing ${t.commandState.activeCommand}...`:"Executing command...",progress:68,tone:"running",nextCommand:null}:t.isLoadingRepoState&&e.loadState.source!=="warm-snapshot"&&e.loadState.source!=="stale-snapshot"?{phase:"opening",visible:!0,label:t.currentLoadSource==="auto"?"Refreshing repo":"Opening repo",detail:t.currentLoadSource==="cli"?"Desktop launched. Kiwi is loading repo-local state now.":t.currentLoadSource==="auto"?"Refreshing repo-local state in the background.":"Building the repo-local control surface.",progress:t.currentLoadSource==="auto"?55:42,tone:"loading",nextCommand:null}:t.isRefreshingFreshRepoState&&Hi(e.loadState.source)?t.lastRepoLoadFailure?{phase:"degraded",visible:!0,label:((n=t.recoveryGuidance)==null?void 0:n.title)??"Using cached snapshot",detail:((i=t.recoveryGuidance)==null?void 0:i.detail)??`Fresh repo-local state could not be loaded: ${t.lastRepoLoadFailure}`,progress:74,tone:((a=t.recoveryGuidance)==null?void 0:a.tone)==="blocked"?"blocked":"degraded",nextCommand:((s=t.recoveryGuidance)==null?void 0:s.nextCommand)??null}:{phase:"warm_loaded",visible:!0,label:e.loadState.source==="stale-snapshot"?"Older snapshot loaded":"Warm state loaded",detail:e.loadState.detail,progress:e.loadState.source==="stale-snapshot"?58:64,tone:"warm",nextCommand:((o=t.recoveryGuidance)==null?void 0:o.nextCommand)??null}:t.recoveryGuidance&&(t.recoveryGuidance.tone==="blocked"||t.recoveryGuidance.tone==="failed")?{phase:t.recoveryGuidance.tone==="failed"?"failed":"ready",visible:!0,label:t.recoveryGuidance.title,detail:t.recoveryGuidance.detail,progress:t.recoveryGuidance.tone==="failed"?100:96,tone:t.recoveryGuidance.tone==="failed"?"degraded":"blocked",nextCommand:t.recoveryGuidance.nextCommand}:e.loadState.source==="bridge-fallback"?{phase:"failed",visible:!0,label:e.readiness.label,detail:t.lastRepoLoadFailure??e.readiness.detail,progress:18,tone:e.readiness.tone==="failed"?"degraded":"blocked",nextCommand:e.readiness.nextCommand}:t.lastReadyStateSignal&&Date.now()-t.lastReadyStateSignal.at<t.readyStatePulseMs?{phase:"ready",visible:!0,label:e.readiness.label,detail:t.machineHydrationInFlight?`${t.lastReadyStateSignal.detail} ${t.machineHydrationDetail}`:e.readiness.detail,progress:100,tone:e.readiness.tone==="blocked"?"blocked":e.readiness.tone==="failed"?"degraded":"ready",nextCommand:e.readiness.nextCommand}:t.currentTargetRoot&&t.machineHydrationInFlight?{phase:"refreshing",visible:!0,label:e.readiness.label,detail:e.readiness.tone==="blocked"?e.readiness.detail:`${e.readiness.detail} ${t.machineHydrationDetail}`,progress:88,tone:e.readiness.tone==="blocked"?"blocked":e.readiness.tone==="failed"?"degraded":"ready",nextCommand:e.readiness.nextCommand}:t.currentTargetRoot&&t.isMachineHeavyViewActive&&t.machineAdvisoryStale?{phase:"warm_loaded",visible:!0,label:"System data deferred",detail:"Kiwi keeps heavy machine diagnostics off the startup path and hydrates them when this view is active.",progress:66,tone:"warm",nextCommand:null}:{phase:t.currentTargetRoot?"ready":"opening",visible:!1,label:"",detail:"",progress:100,tone:"ready",nextCommand:((l=t.recoveryGuidance)==null?void 0:l.nextCommand)??null}}function Mi(e,t){const n=$n(e,t);return n.visible?{label:n.label,detail:n.detail}:e.targetRoot?{label:e.readiness.label,detail:e.readiness.detail}:{label:"opening",detail:"Run kc ui inside a repo to load it automatically."}}function Ei(e){if(!e.targetRoot)return"Run kc ui inside a repo to load it automatically.";switch(e.repoState.mode){case"healthy":return"Repo-local state is loaded and ready.";case"repo-not-initialized":return"This folder is not initialized yet. Run kc init in Terminal to get started.";case"initialized-invalid":return"This repo needs repair before continuity is fully trustworthy.";case"initialized-with-warnings":return"Repo is usable with a few warnings worth addressing.";case"bridge-unavailable":default:return"Confirm kiwi-control works in Terminal, then run kc ui again."}}function Ni(e,t){if(e.readiness.detail)return e.readiness.detail;const i=`Fresh repo-local state is ready for ${Se(e.targetRoot||t)}.`;switch(e.repoState.mode){case"healthy":return i;case"initialized-invalid":return`${i} The repo is loaded, but workflow execution is still blocked until the repo contract is repaired.`;case"repo-not-initialized":return`${i} This repo still needs kc init before the normal workflow can continue.`;case"initialized-with-warnings":return`${i} The repo is usable, but Kiwi still sees warning-level issues worth addressing.`;case"bridge-unavailable":default:return i}}function Fi(e,t,n){if(!e.targetRoot)return n.activeTargetHint;if(e.repoState.mode==="bridge-unavailable")return"Confirm kiwi-control works in Terminal, then run kc ui again.";if(n.recoveryGuidance){const i=n.recoveryGuidance.nextCommand?` Do this now: ${n.recoveryGuidance.nextCommand}.`:"";return`${n.recoveryGuidance.detail}${i} ${n.activeTargetHint}`}if(e.readiness.detail){const i=e.readiness.nextCommand?` Do this now: ${e.readiness.nextCommand}.`:"";return`${e.readiness.detail}${i} ${n.activeTargetHint}`}return n.lastReadyStateSignal&&Date.now()-n.lastReadyStateSignal.at<n.readyStatePulseMs?n.machineHydrationInFlight?`${n.lastReadyStateSignal.detail} ${n.machineHydrationDetail} ${n.activeTargetHint}`:`${n.lastReadyStateSignal.detail} ${n.activeTargetHint}`:e.loadState.source==="stale-snapshot"?`Showing ${Se(e.targetRoot)} from an older snapshot while Kiwi refreshes current repo-local state. ${n.activeTargetHint}`:e.loadState.source==="warm-snapshot"?`Showing ${Se(e.targetRoot)} from a recent warm snapshot while fresh repo-local state refreshes. ${n.activeTargetHint}`:n.machineHydrationInFlight?`Fresh repo-local state is ready for ${Se(e.targetRoot)}. ${n.machineHydrationDetail} ${n.activeTargetHint}`:t==="cli"?`Loaded ${Se(e.targetRoot)} from kc ui. ${n.activeTargetHint}`:t==="manual"?`Loaded ${Se(e.targetRoot)}. ${n.activeTargetHint}`:t==="auto"?`Refreshed ${Se(e.targetRoot)}. ${n.activeTargetHint}`:n.activeTargetHint}function Hi(e){return e==="warm-snapshot"||e==="stale-snapshot"}function Se(e){const t=e.trim();if(!t)return"repo";const n=t.split(/[\\/]/).filter(Boolean);return n[n.length-1]??t}function Di(e){const t=new Set(ji(e.focusPath,e.selectedAnalysis)),n={path:e.rootPath,label:e.rootLabel||"repo",kind:"root",status:"selected",baseX:600,baseY:360,x:600,y:360,radius:34,tone:"tone-root",importance:"high",highlighted:t.has(e.rootPath)},i=[n],a=[],s=[],o=e.tree.nodes.slice(0,10);return o.forEach((l,d)=>{const p=Math.PI*2*d/Math.max(o.length,1),S=600+Math.cos(p)*220,r=360+Math.sin(p)*220,$=Jt(l,e.selectedAnalysis),b={path:l.path,label:l.name,kind:l.kind,status:l.status,baseX:S,baseY:r,x:S,y:r,radius:$==="high"?26:$==="medium"?22:18,tone:`tone-${l.status}`,importance:$,highlighted:t.has(l.path)};i.push(b),a.push({fromPath:n.path,toPath:b.path,highlighted:t.has(n.path)&&t.has(b.path)}),s.push({label:l.name,kind:l.kind,meta:`${l.children.length} child nodes`,path:l.path}),!(e.graphDepth<2)&&l.children.slice(0,e.graphDepth>2?6:4).forEach((u,f)=>{const h=p+(f-1.5)*.32,I=b.baseX+Math.cos(h)*160,N=b.baseY+Math.sin(h)*160,c=Jt(u,e.selectedAnalysis),C={path:u.path,label:u.name,kind:u.kind,status:u.status,baseX:I,baseY:N,x:I,y:N,radius:c==="high"?18:c==="medium"?16:14,tone:`tone-${u.status}`,importance:c,highlighted:t.has(u.path)};i.push(C),a.push({fromPath:b.path,toPath:C.path,highlighted:t.has(b.path)&&t.has(C.path)}),s.push({label:u.name,kind:u.kind,meta:u.status,path:u.path})})}),{rootPath:e.rootPath,nodes:i,edges:a,summary:s,nodesByPath:new Map(i.map(l=>[l.path,l]))}}function _i(e,t){const n=e.nodes.map(s=>{const o=t.get(s.path)??{x:0,y:0};return{path:s.path,label:s.label,kind:s.kind,status:s.status,x:s.baseX+o.x,y:s.baseY+o.y,radius:s.radius,tone:s.tone,importance:s.importance,highlighted:s.highlighted}}),i=new Map(n.map(s=>[s.path,s])),a=e.edges.map(s=>{const o=i.get(s.fromPath),l=i.get(s.toPath);return{fromPath:s.fromPath,toPath:s.toPath,from:{x:(o==null?void 0:o.x)??0,y:(o==null?void 0:o.y)??0},to:{x:(l==null?void 0:l.x)??0,y:(l==null?void 0:l.y)??0},highlighted:s.highlighted}});return{nodes:n,edges:a,summary:e.summary}}function vt(e,t,n){const i=e.nodesByPath.get(n);if(!i)return null;const a=t.get(n)??{x:0,y:0};return{x:i.baseX+a.x,y:i.baseY+a.y}}function ji(e,t){var o;if(!e)return[];const n=(o=t.find(l=>l.file===e))==null?void 0:o.dependencyChain;if(n&&n.length>1)return n;const i=e.split(/[\\/]/).filter(Boolean),a=[];let s=e.startsWith("/")?"/":"";for(const l of i)s=s?`${s.replace(/\/$/,"")}/${l}`:l,a.push(s);return a}function Jt(e,t){var i;const n=t.find(a=>a.file===e.path);return e.status==="selected"||((n==null?void 0:n.score)??0)>=2||(((i=n==null?void 0:n.dependencyChain)==null?void 0:i.length)??0)>1?"high":e.status==="candidate"||e.children.some(a=>a.status==="selected")?"medium":"low"}const yn=[{id:"overview",label:"Overview",icon:F("overview")},{id:"context",label:"Context",icon:F("context")},{id:"graph",label:"Graph",icon:F("graph")},{id:"tokens",label:"Tokens",icon:F("tokens")},{id:"feedback",label:"Feedback",icon:F("feedback")},{id:"mcps",label:"MCPs",icon:F("mcps")},{id:"specialists",label:"Specialists",icon:F("specialists")},{id:"system",label:"System",icon:F("system")},{id:"validation",label:"Validation",icon:F("validation")},{id:"machine",label:"Machine",icon:F("system")}],Oi="Confirm kiwi-control works in Terminal, then run kc ui again.",wn=4500,xn=180,Sn=["inventory","configHealth","mcpInventory"],Vi=["guidance","optimizationLayers","setupPhases","usage"],B={contextView:{task:null,selectedFiles:[],excludedPatterns:[],reason:null,confidence:null,confidenceDetail:null,keywordMatches:[],tree:{nodes:[],selectedCount:0,candidateCount:0,excludedCount:0},timestamp:null},tokenAnalytics:{selectedTokens:0,fullRepoTokens:0,savingsPercent:0,fileCountSelected:0,fileCountTotal:0,estimationMethod:null,estimateNote:null,topDirectories:[],task:null,timestamp:null},efficiency:{instructionsGenerated:!1,instructionsPath:null},nextActions:{actions:[],summary:""},feedback:{totalRuns:0,successRate:0,adaptationLevel:"limited",note:"Adaptive feedback is idle.",basedOnPastRuns:!1,reusedPattern:null,similarTasks:[],recentEntries:[],topBoostedFiles:[],topPenalizedFiles:[]},execution:{totalExecutions:0,totalTokensUsed:0,averageTokensPerRun:0,successRate:0,recentExecutions:[],tokenTrend:"insufficient-data"},wastedFiles:{files:[],totalWastedTokens:0,removalSavingsPercent:0},heavyDirectories:{directories:[]},indexing:{totalFiles:0,observedFiles:0,selectedFiles:0,candidateFiles:0,excludedFiles:0,discoveredFiles:0,analyzedFiles:0,skippedFiles:0,skippedDirectories:0,visitedDirectories:0,maxDepthExplored:0,fileBudgetReached:!1,directoryBudgetReached:!1,partialScan:!1,ignoreRulesApplied:[],skipped:[],indexedFiles:0,indexUpdatedFiles:0,indexReusedFiles:0,impactFiles:0,changedSignals:0,keywordSignals:0,importSignals:0,repoContextSignals:0,scopeArea:null,coverageNote:"Run kiwi-control prepare to record indexing coverage and selection reasoning.",selectionReason:null},fileAnalysis:{totalFiles:0,scannedFiles:0,skippedFiles:0,selectedFiles:0,excludedFiles:0,selected:[],excluded:[],skipped:[]},contextTrace:{initialSignals:{changedFiles:[],recentFiles:[],importNeighbors:[],proximityFiles:[],keywordMatches:[],repoContextFiles:[]},expansionSteps:[],honesty:{heuristic:!0,lowConfidence:!1,partialScan:!1}},tokenBreakdown:{partialScan:!1,categories:[]},decisionLogic:{summary:"",decisionPriority:"low",inputSignals:[],reasoningChain:[],ignoredSignals:[]},runtimeLifecycle:{currentTask:null,currentStage:"idle",validationStatus:null,nextSuggestedCommand:null,nextRecommendedAction:null,recentEvents:[]},measuredUsage:{available:!1,source:"none",totalTokens:0,totalRuns:0,runs:[],workflows:[],files:[],note:"No measured token usage is available yet."},skills:{activeSkills:[],suggestedSkills:[],totalSkills:0},workflow:{task:null,status:"pending",currentStepId:null,steps:[]},executionTrace:{steps:[],whyThisHappened:""},executionPlan:{summary:"",state:"idle",currentStepIndex:0,confidence:null,risk:"low",blocked:!1,steps:[],nextCommands:[],lastError:null},repoIntelligence:{reviewPackAvailable:!1,reviewPackPath:null,reviewPackSummary:null}},Ce=document.querySelector("#app"),Xt=document.querySelector("#boot-overlay");if(!Ce)throw new Error("App root not found");let Z="overview",Te="history",He="all",De=!0,qe=!0,g=zt(""),Le=zi(),$e="execution";const Qt=Ui(),Bi=1e3;let xt,Cn,ie,Pt,Xe,dt,St,Ct,R="",ae=!1,le=!1,Pe=null,at=null,Rn="",ut=0,Be=!1,me=new Set,At=new Set,st=null,ne=null,Tn=0,Q=null,ze=!1,ot=!1,he=null,Ne=null,Ve=!1,Lt=0,Zt="",It=null,en="",nt=null,v={activeCommand:null,loading:!1,composer:null,draftValue:"",lastResult:null,lastError:null},oe=null,E=null,de=new Map,Ue=[],ge=new Map,ke={x:0,y:0},fe=1,se=2,Ie=null,U=null,ee=[],ve=new Set,Me=new Map,je=null,ye="",Mt=new Map,re=0,q=null,te=null,Ye=null,rt=!1,ct=new Set,Re=null,bt=!1;var kn;try{Ce.innerHTML=Gi(),xt=pe(".kc-shell"),Cn=pe("#rail-nav"),ie=pe("#bridge-note"),Pt=pe("#topbar"),Xe=pe("#center-main"),dt=pe("#inspector"),St=pe("#log-drawer"),Ct=pe("#workspace-surface"),tn(),H(g),ie.textContent=gt(g,"shell"),Pn(),Ce.addEventListener("click",e=>{const t=e.target;if(!t)return;const n=e,i=t.closest("[data-view]");if(i!=null&&i.dataset.view){Z=i.dataset.view,L(),En(Z,!1);return}if(t.closest("[data-toggle-logs]")){De=!De,L();return}if(t.closest("[data-toggle-inspector]")){qe=!qe,L();return}const a=t.closest("[data-log-tab]");if(a!=null&&a.dataset.logTab){Te=a.dataset.logTab,L();return}const s=t.closest("[data-validation-tab]");if(s!=null&&s.dataset.validationTab){He=s.dataset.validationTab,L();return}if(t.closest("[data-theme-toggle]")){Le=Le==="dark"?"light":"dark",tn(),L();return}const o=t.closest("[data-ui-mode]");if(o!=null&&o.dataset.uiMode){$e=o.dataset.uiMode,$e==="execution"&&(De=!1,Te="history"),L();return}xa(n,t)||t.closest("[data-reload-state]")&&R&&Qe(R,"manual")}),Ce.addEventListener("input",e=>{const t=e.target;if(t){if(t.matches("[data-command-draft]")){v.draftValue=t.value;return}t.matches("[data-plan-edit-input]")&&(ye=t.value)}}),Ce.addEventListener("change",e=>{const t=e.target;t&&t.matches("[data-command-draft]")&&(v.draftValue=t.value)}),Ce.addEventListener("wheel",e=>{const t=e.target;if(!t||!t.closest("[data-graph-surface]"))return;e.preventDefault(),Oe();const n=e.deltaY>0?-.12:.12;fe=Math.max(.65,Math.min(2.4,Number((fe+n).toFixed(2)))),cn()||Rt()},{passive:!1}),Ce.addEventListener("pointerdown",e=>{const t=e.target;if(!t)return;const n=t.closest("[data-graph-node]");if(n!=null&&n.dataset.path){Oe(),U={mode:"drag-node",path:n.dataset.path,lastClientX:e.clientX,lastClientY:e.clientY};return}t.closest("[data-graph-surface]")&&(Oe(),U={mode:"pan",lastClientX:e.clientX,lastClientY:e.clientY})}),window.addEventListener("pointermove",e=>{if(!U)return;const t=e.clientX-U.lastClientX,n=e.clientY-U.lastClientY;if(Oe(),U.mode==="pan"){ke={x:ke.x+t,y:ke.y+n},U.lastClientX=e.clientX,U.lastClientY=e.clientY,cn()||Rt();return}const i=ge.get(U.path)??{x:0,y:0};ge.set(U.path,{x:i.x+t/fe,y:i.y+n/fe}),U.lastClientX=e.clientX,U.lastClientY=e.clientY,ln(U.path)}),window.addEventListener("pointerup",()=>{(U==null?void 0:U.mode)==="drag-node"&&(Oe(),ln(U.path)),U=null,Ve&&Ee()}),window.addEventListener("keydown",e=>{const t=document.activeElement;if(!(t instanceof HTMLInputElement||t instanceof HTMLTextAreaElement||t instanceof HTMLSelectElement)){if(e.altKey&&e.key.toLowerCase()==="g"){e.preventDefault(),G("guide",[],{expectJson:!0});return}if(e.altKey&&e.key.toLowerCase()==="n"){e.preventDefault(),G("next",[],{expectJson:!0});return}if(e.altKey&&e.key.toLowerCase()==="v"){e.preventDefault(),G("validate",[],{expectJson:!0});return}e.altKey&&e.key==="Enter"&&(e.preventDefault(),G("run-auto",[Ht("run-auto")],{expectJson:!1}))}}),Ki()}catch(e){const t=e instanceof Error?`${e.name}: ${e.message}
${e.stack??""}`:String(e);console.error(t),(kn=window.__KIWI_BOOT_API__)==null||kn.renderError(`Synchronous renderer boot failure:
${t}`)}function pe(e){const t=document.querySelector(e);if(!t)throw new Error(`Shell mount point not found: ${e}`);return t}function zi(){try{const e=window.localStorage.getItem("kiwi-control-theme");if(e==="dark"||e==="light")return e}catch{}return"dark"}function Pn(){const e=window.__KIWI_BOOT_API__;window.requestAnimationFrame(()=>{var n,i,a;if(!(!!((n=Pt.textContent)!=null&&n.trim())||!!((i=Xe.textContent)!=null&&i.trim())||!!((a=dt.textContent)!=null&&a.trim()))){e==null||e.renderError("Renderer mounted but produced no visible UI content.");return}e&&(e.mounted=!0),e==null||e.hide(),Kn(g)})}function Ui(){const e=navigator.userAgent.toLowerCase();return e.includes("win")?"windows":e.includes("mac")?"macos":"linux"}function tn(){xt.dataset.theme=Le,xt.dataset.platform=Qt,document.documentElement.dataset.theme=Le,document.documentElement.dataset.platform=Qt;try{window.localStorage.setItem("kiwi-control-theme",Le)}catch{}}function Gi(){return`
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
  `}async function Ki(){if(await qi())return;await An(),await Yi();const e=await Qn();e?(await J("ui-initial-launch-request-consumed",e.requestId,e.targetRoot),await ht(e)):await J("ui-initial-launch-request-missing"),window.setInterval(()=>{Zi()},250),window.setInterval(()=>{Ji()},Bi),window.setInterval(()=>{Ca()},250)}function Wi(){if(j())return null;const e=new URLSearchParams(window.location.search),t=e.get("preview");return t?{fixturePath:e.get("fixture")??`/preview/${t}.json`}:null}async function qi(){const e=Wi();if(!e)return!1;const t=await fetch(e.fixturePath,{cache:"no-store"});if(!t.ok)throw new Error(`Preview fixture failed to load: ${e.fixturePath}`);const n=await t.json();return g=n.state,R=n.state.targetRoot,ne=n.runtimeInfo??null,n.activeView&&(Z=n.activeView),n.activeMode&&($e=n.activeMode),ie.textContent=n.state.repoState.detail,H(n.state),ft(`Preview loaded for ${n.activeView??"overview"}.`),!0}async function Yi(){if(j())try{await Wt("desktop-launch-request",e=>{ht(e.payload)}),await Wt("repo-state-changed",e=>{Et(e.payload)})}catch{}}async function Et(e){if(!(!e.targetRoot||e.targetRoot!==R)&&!(e.revision<=g.executionState.revision)){if(ae||le||v.loading){at=e;return}await Qe(e.targetRoot,"auto",void 0,{preferSnapshot:!1})}}async function Ji(){if(!(!R||!j()||ae||le))try{const e=await W("get_latest_runtime_revision",{targetRoot:R,afterRevision:g.executionState.revision});e>g.executionState.revision&&await Et({targetRoot:R,revision:e})}catch{}}async function An(){if(j())try{ne=await W("get_desktop_runtime_info");const e=Sa(ne.renderProbeView);e&&(Z=e),L()}catch{ne=null}}async function Xi(){if(!(!j()||v.loading)){v.loading=!0,v.activeCommand=null,v.lastError=null,v.lastResult=null,H(g);try{const e=await W("install_bundled_cli");await An(),v.lastResult={ok:!0,exitCode:0,stdout:e.detail,stderr:"",commandLabel:"install kc"}}catch(e){v.lastError=e instanceof Error?e.message:String(e)}finally{v.loading=!1,H(g)}}}async function Qi(){if(!(!j()||v.loading))try{const e=await W("pick_repo_directory");if(!e)return;await Qe(e,"manual",void 0,{preferSnapshot:!1})}catch(e){v.lastError=e instanceof Error?e.message:String(e),H(g)}}async function ht(e){if(await J("ui-launch-request-received",e.requestId,e.targetRoot),Rn=e.requestId,ae){Pe=e,await J("ui-launch-request-queued",e.requestId,e.targetRoot);return}if(R.trim().length>0&&e.targetRoot===R&&g.repoState.mode!=="bridge-unavailable"&&!le){await J("ui-launch-request-attached",e.requestId,e.targetRoot,g.loadState.source),await Bt(R,g.executionState.revision),ie.textContent=gt(g,"cli"),ft(Vt(g)),H(g),await Ge(e.requestId,R,nn(g.loadState.source)?"hydrating":"ready",nn(g.loadState.source)?`Already attached to ${R}. Fresh repo-local state is still hydrating.`:`Already attached to ${R}. Kiwi reused the active runtime-backed desktop session.`,g.executionState.revision);return}await Qe(e.targetRoot,"cli",e.requestId)}async function Zi(){if(ae||!j())return;const e=await Qn();!e||e.requestId===Rn||(await J("ui-fallback-launch-request-consumed",e.requestId,e.targetRoot),await ht(e))}async function Qe(e,t,n,i={}){if(ae||le){n&&(Pe={requestId:n,targetRoot:e});return}ae=!0,st=t,R=e,Q=null,It=null,oe=null,ie.textContent=t==="cli"?`Opening ${e} from ${n?"kc ui":"the CLI"}...`:t==="auto"?`Refreshing repo-local state for ${e}...`:`Loading repo-local state for ${e}...`,H(g);try{const a=await Zn(e,i.preferSnapshot??!1);if(R=a.targetRoot||e,g=a,Tn=Date.now(),await Bt(R,a.executionState.revision),H(a),ie.textContent=gt(a,t),await J("ui-repo-state-rendered",n,a.targetRoot||e,`${a.repoState.mode}:${a.loadState.source}`),(a.loadState.source==="warm-snapshot"||a.loadState.source==="stale-snapshot")&&t!=="auto"){ae=!1,st=null,le=!0,H(g),n&&await Ge(n,R,"hydrating",a.loadState.source==="stale-snapshot"?`Loaded an older repo snapshot for ${R}. Fresh repo-local state is still hydrating.`:`Loaded a warm repo snapshot for ${R}. Fresh repo-local state is still hydrating.`),window.setTimeout(()=>{ea(R,n)},32);return}Nn(!1),ft(Vt(a)),L(),n&&await Ge(n,R,a.repoState.mode==="bridge-unavailable"?"error":"ready")}catch(a){if(Q=a instanceof Error?a.message:String(a),(t==="auto"||t==="manual")&&g.targetRoot===e&&g.repoState.mode!=="bridge-unavailable"){ie.textContent=`Kiwi kept the last known repo-local state for ${e}. Refresh failed: ${Q}`,H(g),await J("ui-repo-state-retained-after-refresh-failure",n,e,Q);return}const o=zt(e);g=o,R=o.targetRoot||e,ie.textContent=`Kiwi could not load repo-local state for ${e}. ${Q}`,H(o),await J("ui-repo-state-failed",n,e,Q),n&&await Ge(n,e,"error",Q)}finally{ae=!1,st=null,le||(await Ln(n),await In())}}async function ea(e,t){try{const n=await Zn(e,!1);R=n.targetRoot||e,g=n,Tn=Date.now(),Q=null,await Bt(R,n.executionState.revision),Un()?Ee():H(n),ie.textContent=gt(n,"manual"),await J("ui-repo-state-refreshed",t,R,n.repoState.mode),Nn(!1),ft(Vt(n)),Ee(),t&&await Ge(t,R,n.repoState.mode==="bridge-unavailable"?"error":"ready")}catch(n){Q=n instanceof Error?n.message:String(n),ie.textContent=`Showing a warm repo snapshot for ${e}. Fresh refresh failed: ${Q}`,await J("ui-repo-state-refresh-failed",t,e,Q),Ee()}finally{le=!1,await Ln(t),await In()}}async function Ln(e){if(Pe&&Pe.requestId!==e){const t=Pe;Pe=null,await ht(t);return}Pe=null}async function In(){if(!at)return;const e=at;at=null,await Et(e)}async function Ge(e,t,n,i,a=g.executionState.revision){const s=i??(n==="ready"?`Loaded repo-local state for ${t}.`:n==="hydrating"?`Loaded a warm repo snapshot for ${t}. Fresh repo-local state is still hydrating.`:Oi);if(j())try{await J("ui-ack-attempt",e,t,n),await W("ack_launch_request",{requestId:e,targetRoot:t,status:n,detail:s,revision:a}),await J("ui-ack-succeeded",e,t,n)}catch(o){ie.textContent="Kiwi Control loaded this repo, but the desktop launch acknowledgement did not complete yet.",await J("ui-ack-failed",e,t,o instanceof Error?o.message:String(o))}}async function J(e,t,n,i){if(j())try{await W("append_ui_launch_log",{event:e,requestId:t,targetRoot:n,detail:i})}catch{}}function nn(e){return e==="warm-snapshot"||e==="stale-snapshot"}function Mn(e){return e==="machine"||e==="tokens"||e==="mcps"||e==="system"}function ta(e){return[...new Set(e)]}function na(e){switch(e){case"tokens":return["usage","optimizationLayers"];case"mcps":return["mcpInventory","optimizationLayers"];case"system":return["inventory","configHealth","setupPhases"];case"machine":return["guidance","inventory","configHealth"];default:return Sn}}function ia(e){return Mn(e)?ta([...Sn,...Vi]):[]}function an(e,t){return e.filter(n=>{var i;return At.has(n)?((i=g.machineAdvisory.sections[n])==null?void 0:i.status)!=="fresh":!0})}function En(e,t){if(!R||!j())return;const n=an(na(e)),i=an(ia(e).filter(s=>!n.includes(s))),a=++ut;he!=null&&(window.clearTimeout(he),he=null),n.length>0&&sn(t,n,a),i.length>0&&(he=window.setTimeout(()=>{sn(t,i,a),he=null},900))}function Nn(e){En(Z,e)}async function sn(e,t,n){if(!(!j()||t.length===0)){Be=!0;for(const i of t)me.add(i);if(L(),await Promise.all(t.map(i=>aa(i,e,n))),n!==ut){for(const i of t)me.delete(i);me.size===0&&(Be=!1),L();return}for(const i of t)me.delete(i);me.size===0&&(Be=!1),L()}}async function aa(e,t,n){try{const i=await W("load_machine_advisory_section",{section:e,refresh:t});if(n!==ut)return;sa(i),At.add(e),Ee()}catch(i){if(n!==ut)return;g.machineAdvisory.sections[e]={status:"partial",updatedAt:new Date().toISOString(),reason:i instanceof Error?i.message:String(i)},Ee()}}function sa(e){switch(g.machineAdvisory.sections[e.section]=e.meta,e.section){case"inventory":g.machineAdvisory.inventory=e.data;break;case"mcpInventory":g.machineAdvisory.mcpInventory=e.data;break;case"optimizationLayers":g.machineAdvisory.optimizationLayers=e.data;break;case"setupPhases":g.machineAdvisory.setupPhases=e.data;break;case"configHealth":g.machineAdvisory.configHealth=e.data;break;case"usage":g.machineAdvisory.usage=e.data;break;case"guidance":g.machineAdvisory.guidance=oa(e.data);break}g.machineAdvisory.updatedAt=e.meta.updatedAt,g.machineAdvisory.stale=Object.values(g.machineAdvisory.sections).some(t=>t.status!=="fresh"),g.machineAdvisory.systemHealth=ra(g.machineAdvisory)}function oa(e){var l,d,p,S,r,$;const t=((d=(l=g.kiwiControl)==null?void 0:l.contextView.task)==null?void 0:d.toLowerCase())??"",n=((p=g.kiwiControl)==null?void 0:p.workflow.currentStepId)??null,i=g.validation.errors>0,a=(((S=g.kiwiControl)==null?void 0:S.feedback.totalRuns)??0)>0&&(((r=g.kiwiControl)==null?void 0:r.feedback.successRate)??100)<50,s=(($=g.kiwiControl)==null?void 0:$.workflow.steps.some(b=>b.retryCount>0))??!1,o=i||a||s;return e.filter(b=>!(!o&&b.priority!=="critical"||(/\b(read|inspect|review|summarize)\b/.test(t)||/\bdocs?|document|readme\b/.test(t))&&n==="prepare"&&b.id==="missing-ccusage"))}function ra(e){const t=e.guidance.filter(a=>a.priority==="critical").length,n=e.guidance.filter(a=>a.priority==="recommended").length,i=e.inventory.filter(a=>a.installed).length+e.configHealth.filter(a=>a.healthy).length+e.optimizationLayers.filter(a=>a.claude||a.codex||a.copilot).length;return{criticalCount:t,warningCount:n,okCount:i}}function ca(e){const t=e.targetRoot||"";t!==Zt&&(Zt=t,v={activeCommand:null,loading:!1,composer:null,draftValue:"",lastResult:null,lastError:null},oe=null,E=null,de=new Map,Ue=[],ge=new Map,ke={x:0,y:0},fe=1,se=2,Ie=null,ee=[],ve=new Set,Me=new Map,je=null,ye="",Mt=new Map,re=0,q=null,te=null,Ye=null,ct.clear(),rt=!1,At.clear(),me.clear(),Be=!1,he!=null&&(window.clearTimeout(he),he=null)),da(e),la(e)}function la(e){const t=E;if((t==null?void 0:t.kind)==="path"&&jn(e,t.path)||(t==null?void 0:t.kind)==="step"&&Je(e).some(s=>s.id===t.id))return;const i=Dn(e)[0];if(i){E={kind:"path",id:i,label:We(i),path:i};return}const a=Je(e)[0];a&&(E={kind:"step",id:a.id,label:a.displayTitle})}function da(e){const t=(e.kiwiControl??B).executionPlan.steps.map(n=>n.id);if(t.length===0){ee=[],ve.clear(),Me.clear(),je=null,ye="";return}ee.length===0?ee=[...t]:ee=[...ee.filter(n=>t.includes(n)),...t.filter(n=>!ee.includes(n))];for(const n of[...ve])t.includes(n)||ve.delete(n);for(const n of[...Me.keys()])t.includes(n)||Me.delete(n)}function Ze(e){const t=(e.kiwiControl??B).contextView.tree;if(q&&q.baseTree===t&&q.overrideVersion===re)return q.tree;const n=t.nodes.map(s=>Fn(s)),i=Hn(n),a={nodes:n,selectedCount:i.selected,candidateCount:i.candidate,excludedCount:i.excluded};return q={baseTree:t,overrideVersion:re,tree:a,flatNodes:Nt(n)},a}function Fn(e){const t=de.get(e.path),n=t==null?e.status:t==="include"?"selected":"excluded";return{...e,status:n,children:e.children.map(i=>Fn(i))}}function Hn(e){return e.reduce((t,n)=>{n.status==="selected"?t.selected+=1:n.status==="candidate"?t.candidate+=1:t.excluded+=1;const i=Hn(n.children);return t.selected+=i.selected,t.candidate+=i.candidate,t.excluded+=i.excluded,t},{selected:0,candidate:0,excluded:0})}function Dn(e){return _n(e).filter(t=>t.kind==="file"&&t.status==="selected").map(t=>t.path)}function Nt(e){return e.flatMap(t=>[t,...Nt(t.children)])}function _n(e){const t=(e.kiwiControl??B).contextView.tree;return q&&q.baseTree===t&&q.overrideVersion===re?q.flatNodes:(Ze(e),(q==null?void 0:q.flatNodes)??[])}function jn(e,t){return _n(e).find(n=>n.path===t)??null}function Ft(){Ue.push(new Map(de)),Ue.length>20&&Ue.shift()}function $t(e,t){Ft(),de.set(e,t),re+=1,q=null,E={kind:"path",id:e,label:We(e),path:e},Ie=e,L()}function ua(){de.size!==0&&(Ft(),de.clear(),re+=1,q=null,L())}function pa(){const e=Ue.pop();e&&(de=new Map(e),re+=1,q=null,L())}function Ht(e){var n,i,a,s;if(e==="handoff")return g.specialists.handoffTargets[0]??g.specialists.recommendedSpecialist??"";if(e==="checkpoint")return be(g.repoOverview,"Current phase")!=="none recorded"?be(g.repoOverview,"Current phase"):`${Ot(R)} checkpoint`;const t=((i=(n=g.kiwiControl)==null?void 0:n.contextView.task)==null?void 0:i.trim())??"";return t&&t.toLowerCase()!=="task"?t:((s=(a=g.kiwiControl)==null?void 0:a.nextActions.actions[0])==null?void 0:s.action)??""}function On(e){const t=(e==null?void 0:e.trim().toLowerCase())??"";return t.length===0||t==="task"}function Vn(e,t,n){var o,l,d,p;const i=(o=e.kiwiControl)==null?void 0:o.executionPlan,a=i==null?void 0:i.steps.find(S=>S.id==="validate"),s=((l=e.runtimeDecision.recovery)==null?void 0:l.fixCommand)??e.runtimeDecision.nextCommand??e.executionState.nextCommand??e.readiness.nextCommand??(a==null?void 0:a.fixCommand)??(a==null?void 0:a.retryCommand)??((d=i==null?void 0:i.lastError)==null?void 0:d.fixCommand)??((p=i==null?void 0:i.lastError)==null?void 0:p.retryCommand)??(i==null?void 0:i.nextCommands[0])??'kiwi-control validate "task"';return t==="run-auto"&&On(n)?{blocked:!0,reason:"Enter a real goal instead of the placeholder task.",nextCommand:'kiwi-control prepare "real goal"'}:t==="checkpoint"&&(e.executionState.lifecycle==="blocked"||e.executionState.lifecycle==="failed"||(a==null?void 0:a.status)==="failed"||e.validation.errors>0)?{blocked:!0,reason:"Checkpoint is blocked until validation passes.",nextCommand:s}:t==="handoff"&&(e.executionState.lifecycle==="blocked"||e.executionState.lifecycle==="failed"||(a==null?void 0:a.status)==="failed"||e.validation.errors>0)?{blocked:!0,reason:"Handoff is blocked until validation passes.",nextCommand:s}:{blocked:!1,reason:t==="run-auto"?"Run a concrete goal in the loaded repo.":"Ready to run.",nextCommand:null}}function on(e){v.loading||(oe=null,v.composer===e?(v.composer=null,v.draftValue=""):(v.composer=e,v.draftValue=Ht(e)),L())}async function Bn(){R&&await Qe(R,"manual",void 0,{preferSnapshot:!1})}async function G(e,t,n){if(!R||v.loading||!j())return null;v.loading=!0,v.activeCommand=e,v.lastError=null,v.lastResult=null,oe=null,H(g);try{const i=await W("run_cli_command",{command:e,args:t,targetRoot:R,expectJson:n.expectJson});return v.lastResult=i,v.lastError=i.ok?null:zn(i),i.ok?(v.composer=null,v.draftValue="",await Bn()):H(g),i}catch(i){const a=i instanceof Error?i.message:String(i);return await ma(e,t)?v.lastError=`Opened Terminal to run ${e} because desktop subprocess execution failed: ${a}`:v.lastError=a,H(g),null}finally{v.loading=!1,v.activeCommand=null,H(g)}}async function rn(e,t){if(!R||v.loading||!j())return null;v.loading=!0,v.activeCommand="status",v.lastError=null,v.lastResult=null,oe=null,H(g);try{const i=await W("run_cli_command",{command:"pack",args:e==="set"&&t?[e,t,"--json"]:[e,"--json"],targetRoot:R,expectJson:!0});return v.lastResult=i,v.lastError=i.ok?null:zn(i),i.ok?await Bn():H(g),i}catch(n){return v.lastError=n instanceof Error?n.message:String(n),H(g),null}finally{v.loading=!1,v.activeCommand=null,H(g)}}async function ma(e,t){if(!R||!j())return!1;try{return await W("open_terminal_command",{command:e,args:t,targetRoot:R}),!0}catch{return!1}}async function yt(e){if(!(!R||!j()))try{await W("open_path",{targetRoot:R,path:e})}catch(t){v.lastError=t instanceof Error?t.message:String(t),H(g)}}function zn(e){const t=e.jsonPayload;if(t&&typeof t=="object"&&!Array.isArray(t)){const n=t,i=typeof n.failureReason=="string"?n.failureReason.trim():"",a=typeof n.validation=="string"?n.validation.trim():"",s=typeof n.detail=="string"?n.detail.trim():"",o=typeof n.nextCommand=="string"?n.nextCommand.trim():typeof n.nextSuggestedCommand=="string"?n.nextSuggestedCommand.trim():"",l=i||a||s;if(l)return o?`${l} Next: ${_(o,R)}`:l}return e.stderr||e.stdout||`${e.commandLabel} failed`}function ft(e){It={at:Date.now(),detail:e},nt!=null&&window.clearTimeout(nt),nt=window.setTimeout(()=>{nt=null,Ee()},wn+32)}function Oe(){Lt=Date.now()}function Un(){return Z==="graph"&&Date.now()-Lt<xn}function Ee(){if(!Un()){Ve=!1,Ne!=null&&(window.clearTimeout(Ne),Ne=null),L();return}if(Ve=!0,Ne!=null)return;const e=Math.max(0,xn-(Date.now()-Lt));Ne=window.setTimeout(()=>{Ne=null,Ve&&(Ve=!1,L())},e+16)}function ha(){return Re!=null&&Re.isConnected||(Re=Xe.querySelector("[data-graph-viewport]")),Re}function cn(){if(Z!=="graph")return!1;const e=ha();return e?(e.setAttribute("transform",`translate(${ke.x} ${ke.y}) scale(${fe})`),!0):!1}function ln(e){ct.add(e),!(rt||ze||ot)&&(rt=!0,window.requestAnimationFrame(()=>{rt=!1;const t=[...ct];ct.clear(),fa(t)||Rt()}))}function fa(e){if(Z!=="graph"||e.length===0)return!1;const t=Ye??Gn(g);if(!t)return!1;const n=Xe.querySelector("[data-graph-canvas-root]");if(!n)return!1;for(const i of e){const a=`[data-graph-node-wrap][data-path="${Ke(i)}"]`,s=n.querySelector(a),o=vt(t,ge,i);s&&o&&s.setAttribute("transform",`translate(${o.x}, ${o.y})`);const l=[`[data-graph-edge][data-from-path="${Ke(i)}"]`,`[data-graph-edge][data-to-path="${Ke(i)}"]`].join(",");for(const d of n.querySelectorAll(l)){const p=d.dataset.fromPath,S=d.dataset.toPath;if(!p||!S)continue;const r=vt(t,ge,p),$=vt(t,ge,S);!r||!$||(d.setAttribute("x1",String(r.x)),d.setAttribute("y1",String(r.y)),d.setAttribute("x2",String($.x)),d.setAttribute("y2",String($.y)))}}return!0}function Ke(e){return typeof CSS<"u"&&typeof CSS.escape=="function"?CSS.escape(e):e.replace(/["\\]/g,"\\$&")}function pt(e){const t=ga(e);if(t.length<2)return null;const n=t[0]??"";if(!["kiwi-control","kc","shrey-junior","sj"].includes(n))return null;const[i="",...a]=t.slice(1);if(i==="run"&&a[0]==="--auto"){const s=a.find((o,l)=>l>0&&o!=="--target"&&o!==R);return s?{command:"run-auto",args:[s]}:null}if(i==="handoff"){const s=a.findIndex(l=>l==="--to"),o=s>=0?a[s+1]:void 0;if(o)return{command:"handoff",args:[o]}}if(i==="checkpoint"){const s=a.find(o=>!o.startsWith("--"));return s?{command:"checkpoint",args:[s]}:null}if(i==="validate"){const s=a.find(o=>!o.startsWith("--")&&o!==R);return{command:"validate",args:s?[s]:[]}}if(i==="review"){const s=[],o=a.findIndex(d=>d==="--base"),l=o>=0?a[o+1]:void 0;return l&&!l.startsWith("--")&&s.push("--base",l),a.includes("--json")&&s.push("--json"),{command:"review",args:s}}return i==="init"?{command:"init",args:[]}:i==="sync"?{command:"sync",args:a.filter(o=>o==="--dry-run"||o==="--diff-summary"||o==="--backup")}:["guide","next","retry","resume","status","trace"].includes(i)?{command:i,args:a.includes("--json")?["--json"]:[]}:null}function ga(e){return[...e.matchAll(/"([^"]*)"|'([^']*)'|`([^`]*)`|([^\s]+)/g)].map(n=>n[1]??n[2]??n[3]??n[4]??"").filter(Boolean)}async function ka(e){const t=pt(e.command);if(t){await G(t.command,t.args,{expectJson:t.args.includes("--json")});return}if(e.retryCommand){const n=pt(e.retryCommand);if(n){await G(n.command,n.args,{expectJson:n.args.includes("--json")});return}}if(e.id==="execute"){await G("run-auto",[Ht("run-auto")],{expectJson:!1});return}if(e.id.includes("validate")){await G("validate",[],{expectJson:!0});return}await G("next",["--json"],{expectJson:!0})}function Je(e){const t=(e.kiwiControl??B).executionPlan,n=new Map(t.steps.map(i=>[i.id,i]));return ee.map(i=>n.get(i)).filter(i=>!!i).map(i=>{var s,o;const a=Me.get(i.id);return{...i,displayTitle:((s=a==null?void 0:a.label)==null?void 0:s.trim())||i.description,displayNote:((o=a==null?void 0:a.note)==null?void 0:o.trim())||i.result.summary||i.expectedOutput||null,skipped:ve.has(i.id)}})}function dn(e,t){const n=ee.indexOf(e),i=n+t;if(n<0||i<0||i>=ee.length)return;const a=[...ee],s=a[n],o=a[i];!s||!o||(a[n]=o,a[i]=s,ee=a,L())}function va(e){ve.has(e)?ve.delete(e):ve.add(e),L()}function ba(e,t){je=e,ye=t,L()}function $a(e){const t=Me.get(e)??{label:"",note:""};Me.set(e,{...t,label:ye.trim()||t.label}),je=null,ye="",L()}function Gn(e){var o;const t=Ze(e),n=e.targetRoot||"repo",i=Ie??((E==null?void 0:E.kind)==="path"?E.path:null),a=((o=e.kiwiControl)==null?void 0:o.fileAnalysis.selected)??[];if(te&&te.baseTree===t&&te.overrideVersion===re&&te.targetRoot===n&&te.graphDepth===se&&te.focusPath===i&&te.selectedAnalysis===a)return Ye=te.projection,te.projection;const s=Di({tree:t,rootPath:n,rootLabel:Ot(n)||"repo",graphDepth:se,focusPath:i,selectedAnalysis:a});return te={baseTree:t,overrideVersion:re,targetRoot:n,graphDepth:se,focusPath:i,selectedAnalysis:a,projection:s},Ye=s,s}function ya(e){return _i(Gn(e),ge)}function We(e){const t=e.split(/[\\/]/).filter(Boolean);return t[t.length-1]??e}function un(e){return`
    <div class="kc-view-shell">
      <section class="kc-panel kc-command-banner tone-${e.tone==="ready"?"success":e.tone==="degraded"?"warn":e.tone==="blocked"?"blocked":"neutral"}">
        <div class="kc-command-banner-head">
          <div>
            <p class="kc-section-micro">${m(e.phase.replaceAll("_"," "))}</p>
            <strong>${m(e.label)}</strong>
          </div>
          <span class="kc-load-badge"><span class="kc-load-dot"></span>${m(e.phase.replaceAll("_"," "))}</span>
        </div>
        <p>${m(e.detail)}</p>
        ${e.nextCommand?`<div class="kc-command-banner-actions"><code class="kc-command-chip">${m(_(e.nextCommand,R))}</code></div>`:""}
        <div class="kc-load-progress"><span class="kc-load-progress-fill" style="width:${e.progress}%"></span></div>
      </section>
    </div>
  `}function pn(e,t){return`
    <div class="kc-view-shell">
      <section class="kc-panel kc-command-banner tone-${e.tone==="blocked"?"blocked":"warn"}">
        <div class="kc-command-banner-head">
          <div>
            <p class="kc-section-micro">${m(t.kicker)}</p>
            <strong>${m(e.title)}</strong>
          </div>
          <span class="kc-load-badge"><span class="kc-load-dot"></span>${m(e.tone)}</span>
        </div>
        <p>${m(e.detail)}</p>
        <div class="kc-command-banner-actions">
          ${e.nextCommand?`<code class="kc-command-chip">${m(_(e.nextCommand,R))}</code>`:""}
          ${e.followUpCommand?`<code class="kc-command-chip">${m(_(e.followUpCommand,R))}</code>`:""}
          ${t.actionLabel?`<button class="kc-secondary-button" type="button" data-reload-state>${m(t.actionLabel)}</button>`:""}
        </div>
      </section>
    </div>
  `}function wa(){var s,o,l,d;const e=jt(g),t=Dt(g);if(oe)return pn(oe,{kicker:"Action blocked"});if(v.loading||ae)return un(e);if(t&&(t.tone==="blocked"||t.tone==="failed"||t.tone==="degraded")&&(e.visible||t.tone!=="blocked"||g.repoState.mode==="repo-not-initialized"||g.repoState.mode==="initialized-invalid"))return pn(t,{kicker:t.tone==="blocked"?"Workflow blocked":t.tone==="degraded"?"Using cached snapshot":"Load failed",actionLabel:t.actionLabel??null});if(e.visible)return un(e);if(!v.lastResult&&!v.lastError)return"";const n=v.lastError?"warn":(s=v.lastResult)!=null&&s.ok?"success":"warn",i=v.lastError?"Last command failed":(o=v.lastResult)!=null&&o.ok?"Last command completed":"Last command reported an issue",a=v.lastError??((l=v.lastResult)==null?void 0:l.stderr)??((d=v.lastResult)==null?void 0:d.stdout)??"No command detail was recorded.";return`
    <div class="kc-view-shell">
      <section class="kc-panel kc-command-banner tone-${n}">
        <div class="kc-command-banner-head">
          <div>
            <p class="kc-section-micro">Command Result</p>
            <strong>${m(i)}</strong>
          </div>
          ${v.lastResult?`<code class="kc-command-chip">${m(v.lastResult.commandLabel)}</code>`:""}
        </div>
        <p>${m(a)}</p>
      </section>
    </div>
  `}function xa(e,t){var $,b;const n=t.closest("[data-onboarding-action]");if(n!=null&&n.dataset.onboardingAction){const u=n.dataset.onboardingAction;return u==="install-cli"?Xi():u==="choose-repo"?Qi():u==="init-repo"&&R&&G("init",[],{expectJson:!1}),!0}const i=t.closest("[data-ui-command]");if(i!=null&&i.dataset.uiCommand){const u=i.dataset.uiCommand;if(u==="run-auto"||u==="checkpoint"||u==="handoff")on(u);else if(u==="retry"){const f=((b=($=g.kiwiControl)==null?void 0:$.executionPlan.lastError)==null?void 0:b.retryCommand)??"",h=f?pt(f):null;h?G(h.command,h.args,{expectJson:h.args.includes("--json")}):G("retry",[],{expectJson:!1})}else G(u,mn(u)?["--json"]:[],{expectJson:mn(u)});return!0}const a=t.closest("[data-pack-action]");if(a!=null&&a.dataset.packAction){const u=a.dataset.packAction;if(u==="clear")return rn("clear"),!0;if(u==="set"&&a.dataset.packId)return rn("set",a.dataset.packId),!0}const s=t.closest("[data-composer-submit]");if(s!=null&&s.dataset.composerSubmit){const u=s.dataset.composerSubmit,f=v.draftValue.trim(),h=Vn(g,u,f);return h.blocked?(oe=ni(u,h.reason,h.nextCommand),v.lastError=null,L(),!0):f?(G(u==="run-auto"?"run-auto":u==="checkpoint"?"checkpoint":"handoff",[f],{expectJson:!1}),!0):(v.lastError=`${u} requires a value before running.`,oe=null,L(),!0)}if(t.closest("[data-composer-cancel]"))return v.composer=null,v.draftValue="",oe=null,L(),!0;const o=t.closest("[data-tree-action]");if(o!=null&&o.dataset.treeAction&&o.dataset.path){e.preventDefault(),e.stopPropagation();const u=o.dataset.path,f=o.dataset.treeAction;return f==="open"?yt(u):f==="focus"?(E={kind:"path",id:u,label:We(u),path:u},Ie=u,L()):$t(u,f),!0}const l=t.closest("[data-tree-bulk]");if(l!=null&&l.dataset.treeBulk){const u=Ze(g),f=Nt(u.nodes).map(h=>h.path);if(l.dataset.treeBulk==="reset")ua();else if(l.dataset.treeBulk==="undo")pa();else{Ft();for(const h of f)de.set(h,l.dataset.treeBulk);re+=1,q=null,L()}return!0}const d=t.closest("[data-graph-node]");if(d!=null&&d.dataset.path){const u=d.dataset.path;return E={kind:"path",id:u,label:We(u),path:u},Ie=u,e.detail>1&&d.dataset.kind==="file"&&yt(u),L(),!0}const p=t.closest("[data-graph-action]");if(p!=null&&p.dataset.graphAction){const u=p.dataset.path,f=p.dataset.graphAction;if(f==="depth-up")se=Math.min(3,se+1);else if(f==="depth-down")se=Math.max(1,se-1);else if(f==="reset-view")ke={x:0,y:0},fe=1,ge.clear();else if(u)if(f==="open")yt(u);else return f==="focus"?(E={kind:"path",id:u,label:We(u),path:u},Ie=u,L(),!0):($t(u,f),!0);return L(),!0}const S=t.closest("[data-plan-action]");if(S!=null&&S.dataset.planAction&&S.dataset.stepId){const u=S.dataset.stepId,f=Je(g).find(h=>h.id===u);if(!f)return!0;switch(S.dataset.planAction){case"run":ka(f);break;case"retry":if(f.retryCommand){const h=pt(f.retryCommand);h?G(h.command,h.args,{expectJson:h.args.includes("--json")}):G("retry",[],{expectJson:!1})}else G("retry",[],{expectJson:!1});break;case"skip":va(u);break;case"edit":ba(u,f.displayTitle);break;case"edit-save":$a(u);break;case"edit-cancel":je=null,ye="",L();break;case"move-up":dn(u,-1);break;case"move-down":dn(u,1);break;case"focus":E={kind:"step",id:f.id,label:f.displayTitle},L();break}return!0}const r=t.closest("[data-inspector-action]");if(r!=null&&r.dataset.inspectorAction){const u=r.dataset.inspectorAction;if(u==="approve"||u==="reject"){const f=E==null?void 0:E.id;return f&&Mt.set(f,u==="approve"?"approved":"rejected"),L(),!0}if(u==="add-to-context"&&(E==null?void 0:E.kind)==="path")return $t(E.path,"include"),!0;if(u==="validate")return G("validate",[],{expectJson:!0}),!0;if(u==="handoff")return on("handoff"),!0}return!1}function mn(e){return["guide","next","validate","status","trace"].includes(e)}function Sa(e){if(!e)return null;const t=e.trim().toLowerCase();return yn.some(n=>n.id===t)?t:null}function Kn(e){var S,r,$,b;if(!j())return;const t=!!(Xt&&!Xt.classList.contains("is-hidden")),n=jt(e),i=[...document.querySelectorAll("[data-render-section]")].map(u=>u.dataset.renderSection??"").filter(u=>u.length>0),a=[...document.querySelectorAll("[data-ui-command]")].map(u=>u.dataset.uiCommand??"").filter(u=>u.length>0),s=[...document.querySelectorAll('[data-pack-action="set"][data-pack-id]')].map(u=>u.dataset.packId??"").filter(u=>u.length>0),o=(S=e.kiwiControl)==null?void 0:S.executionPlan,l=e.runtimeDecision.currentStepId??((r=o==null?void 0:o.steps[o.currentStepIndex])==null?void 0:r.id)??(($=e.kiwiControl)==null?void 0:$.workflow.currentStepId)??null,d={mounted:!!((b=window.__KIWI_BOOT_API__)!=null&&b.mounted),bootVisible:t,activeView:Z,targetRoot:e.targetRoot,selectedPack:e.mcpPacks.selectedPack.id,selectedPackSource:e.mcpPacks.selectedPackSource,selectablePackIds:s,packCatalog:e.mcpPacks.available.map(u=>({id:u.id,executable:u.executable,unavailablePackReason:u.unavailablePackReason})),repoMode:e.repoState.mode,executionState:e.executionState.lifecycle,executionRevision:e.executionState.revision,currentStep:l,loadPhase:n.phase,loadLabel:n.label,loadDetail:n.detail,visibleSections:i,visibleCommands:a},p=JSON.stringify(d);p!==en&&(en=p,W("write_render_probe",{payload:d}).catch(()=>{}))}async function Ca(){if(!(!j()||bt)){bt=!0;try{const e=await W("consume_render_action");if(!e)return;if(e.actionType==="click-pack"&&e.packId){const t=document.querySelector(`[data-pack-action="set"][data-pack-id="${Ke(e.packId)}"]`);if(t){t.click();return}const n=document.querySelector(`[data-pack-card="true"][data-pack-id="${Ke(e.packId)}"] summary`);n==null||n.click();return}if(e.actionType==="clear-pack"){const t=document.querySelector('[data-pack-action="clear"]');t==null||t.click()}}catch{}finally{bt=!1}}}function H(e){var t;g=e,ca(e),Cn.innerHTML=Ra(),Pt.innerHTML=Ta(e),Wn(e),dt.innerHTML=qa(e),St.innerHTML=Ja(e),Ct.classList.toggle("is-inspector-open",qe),Ct.classList.toggle("is-log-open",De),dt.classList.toggle("is-hidden",!qe),St.classList.toggle("is-hidden",!De),(t=window.__KIWI_BOOT_API__)!=null&&t.mounted||Pn(),Kn(e)}function Wn(e){Xe.innerHTML=`${wa()}${La(e)}`,Re=null,Z!=="graph"&&(Ye=null)}function L(){ze||(ze=!0,window.requestAnimationFrame(()=>{ze=!1,H(g)}))}function Rt(){ot||ze||(ot=!0,window.requestAnimationFrame(()=>{ot=!1,Wn(g)}))}function Ra(){return yn.map(e=>`
    <button class="kc-rail-button ${e.id===Z?"is-active":""}" data-view="${e.id}" type="button">
      <span class="kc-rail-icon">${e.icon}</span>
      <span class="kc-rail-label">${m(e.label)}</span>
    </button>
  `).join("")}function Ta(e){var S,r,$,b;const t=qn(e),n=Ot(e.targetRoot),i=be(e.repoOverview,"Current phase"),a=be(e.repoOverview,"Validation state"),s=Le==="dark"?"Light mode":"Dark mode",o=((S=e.kiwiControl)==null?void 0:S.contextView.task)??(($=(r=e.kiwiControl)==null?void 0:r.nextActions.actions[0])==null?void 0:$.action)??"",l=!!((b=e.runtimeDecision.recovery)!=null&&b.retryCommand)||!!R,d=v.composer?Vn(e,v.composer,v.draftValue):null,p=ne?{label:"App",detail:`${rs(ne.buildSource)} · v${ne.appVersion}${ne.runtimeIdentity?` · runtime ${ne.runtimeIdentity.packagingSourceCategory} (${ne.runtimeIdentity.callerSurface})`:""}`}:null;return li({state:e,decision:t,repoLabel:n,phase:i,validationState:a,themeLabel:s,activeTheme:Le,activeMode:$e,isLogDrawerOpen:De,isInspectorOpen:qe,currentTargetRoot:R,commandState:v,currentTask:o,retryEnabled:l,composerConstraint:d,runtimeInfo:p,loadStatus:jt(e),helpers:et()})}function Pa(){const e=me.size;return e===0?"Refreshing machine-local diagnostics in the background.":`Refreshing ${[...me].map(n=>{switch(n){case"mcpInventory":return"MCP inventory";case"optimizationLayers":return"optimization layers";case"setupPhases":return"setup phases";case"configHealth":return"config health";default:return n}}).join(", ")}${e>1?" in the background":""}.`}function Dt(e){return ti(e,{lastRepoLoadFailure:Q})}function _t(e){return{commandState:{loading:v.loading,activeCommand:v.activeCommand},currentLoadSource:st,currentTargetRoot:R,isLoadingRepoState:ae,isRefreshingFreshRepoState:le,lastRepoLoadFailure:Q,lastReadyStateSignal:It,readyStatePulseMs:wn,machineHydrationInFlight:Be,machineHydrationDetail:Pa(),activeTargetHint:Ei(e),recoveryGuidance:Dt(e),isMachineHeavyViewActive:Mn(Z),machineAdvisoryStale:e.machineAdvisory.stale}}function jt(e){return $n(e,_t(e))}function qn(e){return fi(e,{isLoadingRepoState:ae,isRefreshingFreshRepoState:le,hasWarmSnapshot:e.loadState.source==="warm-snapshot"||e.loadState.source==="stale-snapshot",formatTimestamp:ce})}function Aa(e,t){return`
    <div class="kc-inline-meta">
      <span>${m(e)}</span>
      <strong>${m(t)}</strong>
    </div>
  `}function et(){return{escapeHtml:m,escapeAttribute:Ut,iconSvg:F,iconLabel:Xn,formatCliCommand:_,renderHeaderBadge:Y,renderHeaderMeta:Aa,renderPanelHeader:x,renderInlineBadge:K,renderNoteRow:y,renderEmptyState:P,renderStatCard:A,renderInfoRow:T,renderListBadges:_e,renderExplainabilityBadge:lt,renderGateRow:Yn,renderBulletRow:ue,deriveSignalImpact:Qa,formatInteger:as,formatPercent:ss,formatCurrency:os,formatTimestamp:ce,formatTokensShort:D}}function La(e){switch(Z){case"context":return Ea(e);case"graph":return Na(e);case"tokens":return Da(e);case"feedback":return Wa(e);case"mcps":return _a(e);case"specialists":return Ua(e);case"system":return Ga(e);case"validation":return Fa(e);case"machine":return Ka(e);case"overview":default:return Ma(e)}}function Ia(e){return Mi(e,_t(e))}function Ma(e){var c,C,M,z,O,V;const t=e.kiwiControl??B,n=Ze(e),i=qn(e),a=Ia(e),s=Dt(e),o=t.nextActions.actions[0]??null,l=_(o==null?void 0:o.command,e.targetRoot),d=l||_(t.executionPlan.nextCommands[0],e.targetRoot)||"No next command is currently recorded.",p=be(e.continuity,"Current focus"),S=((c=e.specialists.activeProfile)==null?void 0:c.name)??e.specialists.activeSpecialist,r=t.contextView.task??"No prepared task",$=e.mcpPacks.compatibleCapabilities.length,b=t.feedback.topBoostedFiles.slice(0,3).map(w=>w.file),u=Ri({targetRoot:e.targetRoot,repoMode:e.repoState.mode}),f=Ti(t.fileAnalysis.selected),h=Pi({targetRoot:e.targetRoot,recoveryGuidance:s,executionPlan:t.executionPlan}),I=Ai({targetRoot:e.targetRoot,recoveryGuidance:s,executionPlan:t.executionPlan}),N=yi({runtimeInfo:ne,targetRoot:e.targetRoot,repoMode:e.repoState.mode});return`
    <div class="kc-view-shell">
      <section class="kc-panel kc-panel-primary">
        <div class="kc-panel-heading">
          <div class="kc-panel-kicker">
            ${Xn(F("overview"),"Next Action")}
            ${o?Y(o.priority,o.priority):Y("stable","neutral")}
          </div>
          <h1>${m((o==null?void 0:o.action)??e.repoState.title)}</h1>
          <p>${m((o==null?void 0:o.reason)??(t.nextActions.summary||e.repoState.detail))}</p>
        </div>
        <div class="kc-primary-footer">
          ${l?`<code class="kc-command-chip">${m(l)}</code>`:""}
          <span>${m(p)}</span>
        </div>
      </section>

      ${N?wi(N,et()):""}

      <div class="kc-stat-grid">
        ${A("Repo Health",e.repoState.title,e.validation.ok?"passing":`${e.validation.errors+e.validation.warnings} issues`,e.validation.ok?"success":"warn")}
        ${A("Task",r,t.contextView.confidenceDetail??"no prepared scope","neutral")}
        ${A("Selected",String(n.selectedCount),"files Kiwi chose","neutral")}
        ${A("Ignored",String(n.excludedCount),"files Kiwi filtered out","warn")}
        ${A("Lifecycle",e.executionState.lifecycle,e.executionState.reason??e.readiness.detail,e.executionState.lifecycle==="blocked"||e.executionState.lifecycle==="failed"?"warn":"neutral")}
        ${A("Skills",String(t.skills.activeSkills.length),t.skills.activeSkills.length>0?t.skills.activeSkills.map(w=>w.name).join(", "):"none active","neutral")}
      </div>

      <section class="kc-panel" data-render-section="guided-operation">
        ${x("Guided Operation","What is happening, what is wrong, and what to do next.")}
        <div class="kc-two-column">
          <section class="kc-subpanel">
            <div class="kc-stack-list">
              ${y("Readiness",a.label,a.detail)}
              ${y("Current state",e.repoState.title,e.repoState.detail)}
              ${y("Blocking issue",i.blockingIssue,i.systemHealth==="blocked"?"Resolve this before trusting execution.":"No hard blocker is currently active.")}
              ${y("Recommended next action",i.nextAction,d)}
              ${s?y("Do this now",s.title,s.nextCommand?_(s.nextCommand,e.targetRoot):s.detail):""}
            </div>
          </section>
          <section class="kc-subpanel">
            <div class="kc-stack-list">
              ${y("Execution safety",i.executionSafety,i.executionSafety==="ready"?"Execution is safe to continue.":i.executionSafety==="guarded"?"Context or validation signals suggest caution.":"Wait for hydration or clear blockers first.")}
              ${y("Recent change",i.lastChangedAt,((C=t.runtimeLifecycle.recentEvents[0])==null?void 0:C.summary)??"No recent lifecycle event is recorded.")}
              ${y("State trust","repo-local","Repo state and .agent artifacts remain authoritative. Local UI-only edits do not replace repo truth.")}
            </div>
          </section>
        </div>
      </section>

      ${I.length>0?`
          <section class="kc-panel" data-render-section="blocked-workflow-fix">
            ${x("How To Unblock Workflow","A concrete recovery workflow derived from the current blocked execution plan and repo-local recovery state.")}
            <div class="kc-stack-list">
              ${I.map((w,we)=>y(`${we+1}. ${w.title}`,w.command,w.detail)).join("")}
            </div>
          </section>
        `:""}

      <div class="kc-two-column">
        <section class="kc-panel" data-render-section="explain-selection">
          ${x("Explain This Selection","Low-latency parity with kc explain using the already-loaded repo state, file reasons, and dependency chains.")}
          ${f.length>0?`<div class="kc-stack-list">${f.map(w=>y(w.title,w.metric,w.note)).join("")}</div>`:P("No selected-file reasoning is available yet. Run kc prepare to build a bounded working set first.")}
        </section>
        <section class="kc-panel" data-render-section="terminal-recovery">
          ${x("Terminal Recovery","Exact commands to run next in Terminal, grounded in the current repo state instead of a second explain round-trip.")}
          ${h.length>0?`<div class="kc-stack-list">${h.map(w=>y(w.command,w.label,w.detail)).join("")}</div>`:P("No repo-scoped recovery commands are recorded yet.")}
        </section>
      </div>

      <section class="kc-panel" data-render-section="terminal-help">
        ${x("Terminal Help","The same command surface you would reach for from kc help, with repo-scoped commands already pinned to the active repo.")}
        <div class="kc-two-column">
          <section class="kc-subpanel">
            <div class="kc-stack-list">
              ${u.slice(0,3).map(w=>y(w.command,w.label,w.detail)).join("")}
            </div>
          </section>
          <section class="kc-subpanel">
            <div class="kc-stack-list">
              ${u.slice(3).map(w=>y(w.command,w.label,w.detail)).join("")}
            </div>
          </section>
        </div>
      </section>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${x("Repo State","Current repo truth, routing, and system fit.")}
          <div class="kc-info-grid">
            ${T("Project type",e.projectType)}
            ${T("Execution mode",e.executionMode)}
            ${T("Active specialist",S)}
            ${T("Selected pack",e.mcpPacks.selectedPack.name??e.mcpPacks.selectedPack.id)}
            ${T("Compatible MCPs",String($))}
            ${T("Feedback",`${t.feedback.adaptationLevel} (${t.feedback.totalRuns} runs)`)}
            ${T("Measured usage",t.measuredUsage.available?`${D(t.measuredUsage.totalTokens)} over ${t.measuredUsage.totalRuns} runs`:"unavailable")}
          </div>
        </section>
        <section class="kc-panel">
          ${x("Task Summary","What Kiwi knows right now about the active working set.")}
          <div class="kc-keyline-value">
            <strong>${m(r)}</strong>
            <span>${m((t.indexing.selectionReason??t.contextView.reason??t.nextActions.summary)||e.repoState.detail)}</span>
          </div>
          <div class="kc-stack-list">
            ${y("Review pack",t.repoIntelligence.reviewPackAvailable?t.repoIntelligence.reviewPackPath??"ready":"not generated",t.repoIntelligence.reviewPackSummary??"Run kc review to write the compact local review workflow for the current diff.")}
          </div>
        </section>
      </div>

      ${Ya(e)}

      <section class="kc-panel">
        <div class="kc-panel-head-row">
          ${x("Context Tree","What Kiwi selected, considered, and ignored from the live selector state.")}
          ${Y(((M=t.contextView.confidence)==null?void 0:M.toUpperCase())??"UNKNOWN",t.contextView.confidence==="high"?"success":t.contextView.confidence==="low"?"warn":"neutral")}
        </div>
        ${n.nodes.length>0?Jn(n):P('Run kc prepare "your task" to build a repo-local context tree.')}
      </section>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${x("What Kiwi Knows","Immediate operating context exposed as concrete system signals.")}
          <div class="kc-stack-list">
            ${y("Reasoning",((z=t.contextView.confidence)==null?void 0:z.toUpperCase())??"unknown",t.contextView.confidenceDetail??"No context confidence has been recorded yet.")}
            ${y("Indexing",`${t.indexing.discoveredFiles} files`,t.indexing.coverageNote)}
            ${y("Validation",`${e.validation.errors} errors / ${e.validation.warnings} warnings`,e.repoState.detail)}
          </div>
        </section>
        <section class="kc-panel">
          ${x("What Kiwi Learned","Adaptive feedback and recent system memory for this task scope.")}
          ${t.feedback.basedOnPastRuns?`<div class="kc-stack-list">
                ${y("based on past runs",t.feedback.reusedPattern??"similar work",t.feedback.note)}
                ${t.feedback.similarTasks.slice(0,3).map(w=>y(w.task,`similarity ${w.similarity}`,ce(w.timestamp))).join("")}
              </div>`:b.length>0?_e(b):P("No learned file preference is strong enough to surface yet.")}
        </section>
      </div>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${x("Active Skills","Repo-local skills currently shaping the task instructions and workflow trace.")}
          ${t.skills.activeSkills.length>0?`<div class="kc-stack-list">${t.skills.activeSkills.map(w=>y(w.name,`score ${w.score}`,w.executionTemplate[0]??w.description)).join("")}</div>`:P("No repo-local skills matched the active task.")}
        </section>
        <section class="kc-panel">
          ${x("Suggested Skills","Additional repo-local skills that may become relevant as the task expands.")}
          ${t.skills.suggestedSkills.length>0?`<div class="kc-stack-list">${t.skills.suggestedSkills.map(w=>y(w.name,`score ${w.score}`,w.description||w.triggerConditions.join(", "))).join("")}</div>`:P("No additional skills are currently suggested.")}
        </section>
      </div>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${x("HOW IT WORKS","What Kiwi did, how it did it, and what it intentionally left out.")}
          <div class="kc-stack-list">
            ${y("What was done",`${t.fileAnalysis.selectedFiles} selected`,"Kiwi built a bounded working set from repo-local signals, then trimmed low-relevance files.")}
            ${y("How it was done",`${t.contextTrace.expansionSteps.length} trace steps`,((O=t.contextTrace.expansionSteps[0])==null?void 0:O.summary)??"No context trace has been recorded yet.")}
            ${y("Why it was done",t.decisionLogic.decisionPriority,t.decisionLogic.summary||"No decision summary is recorded yet.")}
            ${y("What was ignored",`${t.fileAnalysis.excludedFiles} excluded / ${t.fileAnalysis.skippedFiles} skipped`,t.decisionLogic.ignoredSignals[0]??((V=t.fileAnalysis.excluded[0])==null?void 0:V.note)??"No ignored signals are currently surfaced.")}
          </div>
        </section>
        <section class="kc-panel">
          ${x("DECISION LOGIC","The reasoning chain behind the current primary action.")}
          ${t.decisionLogic.reasoningChain.length>0?`<div class="kc-stack-list">${t.decisionLogic.reasoningChain.slice(0,4).map(w=>ue(w)).join("")}</div>`:P("No decision reasoning is available yet.")}
        </section>
      </div>
    </div>
  `}function Ea(e){var d;const t=e.kiwiControl??B,n=t.contextView,i=t.indexing,a=Ze(e),s=Dn(e),o=a.nodes.slice(0,8),l=Oa(e);return`
    <div class="kc-view-shell">
      <section class="kc-view-header">
        <div>
          <p class="kc-view-kicker">Context Selection</p>
          <h1>${m(n.task??"No prepared task")}</h1>
          <p>${m(n.confidenceDetail??"Kiwi Control only shows files the selector actually considered.")}</p>
        </div>
        <div class="kc-header-metrics">
          ${wt(String(n.tree.selectedCount),"selected")}
          ${wt(String(n.tree.candidateCount),"candidate")}
          ${wt(String(n.tree.excludedCount),"excluded")}
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
          ${a.nodes.length>0?Jn(a):P('Run kc prepare "your task" to build the repo tree from live selection signals.')}
        </section>

        <section class="kc-panel">
          ${x("Navigation Map","Use this as a high-density orientation strip before drilling into the full tree.")}
          ${o.length>0?`<div class="kc-inline-badges">${o.map(p=>K(`${p.name}:${p.status}`)).join("")}</div>`:P("No top-level repo map is available yet.")}
          <div class="kc-divider"></div>
          ${x("Selection State",n.reason??"No selection reason recorded.")}
          <div class="kc-info-grid">
            ${T("Confidence",((d=n.confidence)==null?void 0:d.toUpperCase())??"UNKNOWN")}
            ${T("Scope area",i.scopeArea??"unknown")}
            ${T("Selected files",String(s.length))}
            ${T("Observed files",String(i.observedFiles))}
            ${T("Indexed files",String(i.indexedFiles))}
            ${T("Impact files",String(i.impactFiles))}
            ${T("Keyword matches",String(i.keywordSignals))}
            ${T("Import neighbors",String(i.importSignals))}
            ${T("Discovery depth",String(i.maxDepthExplored))}
          </div>
          <div class="kc-divider"></div>
          <div class="kc-stack-block">
            <p class="kc-stack-label">Coverage</p>
            <p class="kc-support-copy">${m(i.coverageNote)}</p>
            <div class="kc-inline-badges">
              ${K(`visited ${i.visitedDirectories} dirs`)}
              ${K(i.fileBudgetReached?"file budget hit":"file budget clear")}
              ${K(i.directoryBudgetReached?"dir budget hit":"dir budget clear")}
            </div>
          </div>
          <div class="kc-divider"></div>
          <div class="kc-stack-block">
            <p class="kc-stack-label">Selected files</p>
            ${s.length>0?_e(s):P("No active files are selected yet.")}
          </div>
        </section>
      </div>

      <section class="kc-panel">
        ${x("How Kiwi Indexed This Repo","These are the actual scan and signal mechanics behind the current tree, not generic advice.")}
        <div class="kc-stack-list">
          ${l.map(p=>y(p.title,p.metric,p.note)).join("")}
        </div>
      </section>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${x("FILE ANALYSIS PANEL","Measured scan counts plus why files were selected, excluded, or skipped.")}
          <div class="kc-info-grid">
            ${T("Total files",String(t.fileAnalysis.totalFiles))}
            ${T("Scanned files",String(t.fileAnalysis.scannedFiles))}
            ${T("Skipped files",String(t.fileAnalysis.skippedFiles))}
            ${T("Selected files",String(t.fileAnalysis.selectedFiles))}
            ${T("Excluded files",String(t.fileAnalysis.excludedFiles))}
          </div>
          <div class="kc-divider"></div>
          <div class="kc-stack-list">
            ${t.fileAnalysis.selected.slice(0,3).map(p=>y(p.file,"selected",p.selectionWhy??p.reasons.join(", "))).join("")}
            ${t.fileAnalysis.excluded.slice(0,3).map(p=>y(p.file,"excluded",p.note??p.reasons.join(", "))).join("")}
            ${t.fileAnalysis.skipped.slice(0,3).map(p=>y(p.path,"skipped",p.reason)).join("")}
          </div>
        </section>
        <section class="kc-panel">
          ${x("CONTEXT TRACE","Initial signals, expansion steps, and final bounded selection.")}
          ${t.contextTrace.expansionSteps.length>0?`<div class="kc-fold-grid">${t.contextTrace.expansionSteps.map(p=>`
                <details class="kc-fold-card" open>
                  <summary>
                    <div>
                      <strong>${m(p.step)}</strong>
                      <span>${m(p.summary)}</span>
                    </div>
                    ${Y(`${p.filesAdded.length} files`,"neutral")}
                  </summary>
                  <div class="kc-fold-body">
                    ${p.filesAdded.length>0?_e(p.filesAdded.slice(0,8)):P("No files recorded for this step.")}
                    ${p.filesRemoved&&p.filesRemoved.length>0?`<div class="kc-divider"></div>${_e(p.filesRemoved.slice(0,8))}`:""}
                  </div>
                </details>
              `).join("")}</div>`:P("Run kc prepare to record a trace of how Kiwi built the working set.")}
        </section>
      </div>

      <section class="kc-panel">
        ${x("Dependency Chains","Shortest structural paths that pulled files into the working set.")}
        ${t.fileAnalysis.selected.some(p=>Array.isArray(p.dependencyChain)&&p.dependencyChain.length>1)?`<div class="kc-stack-list">${t.fileAnalysis.selected.filter(p=>Array.isArray(p.dependencyChain)&&p.dependencyChain.length>1).slice(0,6).map(p=>y(p.file,"chain",(p.dependencyChain??[]).join(" -> "))).join("")}</div>`:P("No structural dependency chain was needed for the current selection.")}
      </section>

      <section class="kc-panel">
        ${x("INDEXING","How the repo scan progressed, where it stopped, and which ignore rules were applied.")}
        <div class="kc-info-grid">
          ${T("Directories visited",String(i.visitedDirectories))}
          ${T("Skipped directories",String(i.skippedDirectories))}
          ${T("Depth reached",String(i.maxDepthExplored))}
          ${T("Files discovered",String(i.discoveredFiles))}
          ${T("Files analyzed",String(i.analyzedFiles))}
          ${T("Index reused",String(i.indexReusedFiles))}
          ${T("Index refreshed",String(i.indexUpdatedFiles))}
          ${T("Ignore rules",String(i.ignoreRulesApplied.length))}
        </div>
        <div class="kc-divider"></div>
        <div class="kc-inline-badges">
          ${lt("heuristic",t.contextTrace.honesty.heuristic)}
          ${lt("low confidence",t.contextTrace.honesty.lowConfidence)}
          ${lt("partial scan",t.contextTrace.honesty.partialScan||i.partialScan)}
        </div>
        <div class="kc-divider"></div>
        <div class="kc-stack-list">
          ${i.ignoreRulesApplied.slice(0,4).map(p=>ue(p)).join("")}
        </div>
      </section>
    </div>
  `}function Na(e){const t=ya(e),n=t.nodes.find(i=>i.path===(Ie??((E==null?void 0:E.kind)==="path"?E.path:null)))??null;return di({state:e,graph:t,focusedNode:n,graphDepth:se,graphPan:ke,graphZoom:fe,graphMechanics:Va(e,t),treeMechanics:Ba(e),helpers:et()})}function Fa(e){const t=e.validation.issues??[],n=t.filter(a=>a.level==="warn"),i=t.filter(a=>a.level==="error");return`
    <div class="kc-view-shell">
      <section class="kc-view-header">
        <div>
          <p class="kc-view-kicker">Validation</p>
          <h1>${m(e.repoState.title)}</h1>
          <p>${m(e.repoState.detail)}</p>
        </div>
        <button class="kc-secondary-button" type="button" data-reload-state>${F("refresh")}Reload state</button>
      </section>

      <div class="kc-stat-grid">
        ${A("Passing",e.validation.ok?"yes":"no","repo contract",e.validation.ok?"success":"warn")}
        ${A("Errors",String(e.validation.errors),"blocking",e.validation.errors>0?"critical":"neutral")}
        ${A("Warnings",String(e.validation.warnings),"non-blocking",e.validation.warnings>0?"warn":"neutral")}
        ${A("Memory",`${e.memoryBank.filter(a=>a.present).length}/${e.memoryBank.length}`,"surfaces present","neutral")}
      </div>

      <section class="kc-panel">
        <div class="kc-tab-row">
          ${Ae("all",He,"All")}
          ${Ae("issues",He,`Issues ${i.length+n.length>0?`(${i.length+n.length})`:""}`,"data-validation-tab")}
          ${Ae("pending",He,"Pending","data-validation-tab")}
        </div>
        ${Ha(e)}
      </section>
    </div>
  `}function Ha(e){const n=(e.validation.issues??[]).filter(i=>i.level==="error"||i.level==="warn");return He==="issues"?n.length>0?`<div class="kc-stack-list">${n.map(ts).join("")}</div>`:P("No warnings or errors are currently recorded in repo-local validation."):He==="pending"?P("Kiwi Control does not infer pending checks beyond repo-local validation state."):`
    <div class="kc-two-column">
      <section class="kc-subpanel">
        ${x("Repo Contract",e.repoState.sourceOfTruthNote)}
        <div class="kc-info-grid">
          ${e.repoOverview.map(i=>T(i.label,i.value,i.tone==="warn"?"warn":"default")).join("")}
        </div>
      </section>
      <section class="kc-subpanel">
        ${x("Continuity","Latest checkpoint, handoff, reconcile, and open risk state.")}
        <div class="kc-info-grid">
          ${e.continuity.map(i=>T(i.label,i.value,i.tone==="warn"?"warn":"default")).join("")}
        </div>
      </section>
    </div>
  `}function Da(e){const t=e.kiwiControl??B,n=t.tokenAnalytics;return`
    <div class="kc-view-shell">
      <section class="kc-view-header">
        <div>
          <p class="kc-view-kicker">Token Analytics</p>
          <h1>${m(n.task??"No token estimate yet")}</h1>
          <p>${m(n.estimateNote??'Run kc prepare "your task" to generate a repo-local rough estimate.')}</p>
        </div>
        ${Y(n.estimationMethod??"not generated","neutral")}
      </section>

      <div class="kc-stat-grid">
        ${A("Selected",`~${D(n.selectedTokens)}`,"approximate","neutral")}
        ${A("Full Repo",`~${D(n.fullRepoTokens)}`,"approximate","neutral")}
        ${A("Saved",`~${n.savingsPercent}%`,"approximate","success")}
        ${A("Measured Files",`${n.fileCountSelected}/${n.fileCountTotal}`,"direct count","neutral")}
        ${A("Measured Usage",t.measuredUsage.available?D(t.measuredUsage.totalTokens):"unavailable",t.measuredUsage.available?`${t.measuredUsage.totalRuns} real runs`:"falling back to estimate",t.measuredUsage.available?"success":"warn")}
      </div>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${x("Measured Usage",t.measuredUsage.note)}
          ${t.measuredUsage.available?`<div class="kc-stack-list">
                ${y("Source",t.measuredUsage.source,t.measuredUsage.note)}
                ${t.measuredUsage.workflows.slice(0,4).map(i=>y(i.workflow,`${D(i.tokens)} tokens`,`${i.runs} runs`)).join("")}
              </div>`:P("No measured repo usage was found in local session or execution logs.")}
        </section>
        <section class="kc-panel">
          ${x("Estimated Usage",n.estimationMethod??"No estimate method recorded.")}
          <div class="kc-stack-list">
            ${y("Selected working set",`~${D(n.selectedTokens)}`,"Heuristic estimate for the current bounded context.")}
            ${y("Full repo",`~${D(n.fullRepoTokens)}`,"Heuristic estimate for all scanned repo files.")}
            ${y("Savings",`~${n.savingsPercent}%`,"Measured file counts with heuristic token estimation.")}
          </div>
        </section>
      </div>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${x("Top Directories","Measured directories with the largest share of estimated token usage.")}
          ${n.topDirectories.length>0?`<div class="kc-bar-list">${n.topDirectories.slice(0,6).map(i=>es(i.directory,i.tokens,n.fullRepoTokens,`${i.fileCount} files`)).join("")}</div>`:P("No directory analytics recorded yet.")}
        </section>
        <section class="kc-panel">
          ${x("Context Breakdown",n.estimationMethod??"No estimate method recorded.")}
          ${gn("Selected vs repo",n.selectedTokens,n.fullRepoTokens)}
          ${t.wastedFiles.files.length>0?gn("Wasted within selection",t.wastedFiles.totalWastedTokens,n.selectedTokens):""}
          <div class="kc-divider"></div>
          ${t.wastedFiles.files.length>0?`<div class="kc-stack-list">${t.wastedFiles.files.slice(0,4).map(i=>y(i.file,`${D(i.tokens)} tokens`,i.reason)).join("")}</div>`:P("No wasted files are recorded in the active selection.")}
        </section>
      </div>

      <section class="kc-panel">
        ${x("How To Reduce Tokens","Concrete actions that affect selection size, measured usage, and model tradeoffs.")}
        <div class="kc-stack-list">
          ${ja(e).map(i=>y(i.title,i.metric,i.note)).join("")}
        </div>
      </section>

      <section class="kc-panel">
        ${x("Why These Token Numbers Look This Way","Token analytics here are driven by the indexed tree, selected working set, and measured local execution data when available.")}
        <div class="kc-stack-list">
          ${za(e).map(i=>y(i.title,i.metric,i.note)).join("")}
        </div>
      </section>

      <section class="kc-panel">
        ${x("Heavy Directories","Directories that dominate repo token volume.")}
        ${t.heavyDirectories.directories.length>0?`<div class="kc-stack-list">${t.heavyDirectories.directories.slice(0,4).map(i=>y(i.directory,`${i.percentOfRepo}% of repo`,i.suggestion)).join("")}</div>`:P("No heavy-directory warnings are recorded for this repo.")}
      </section>

      <section class="kc-panel">
        ${x("TOKEN BREAKDOWN","Where token reduction came from, and whether that reduction is measured or heuristic.")}
        ${t.tokenBreakdown.categories.length>0?`<div class="kc-stack-list">${t.tokenBreakdown.categories.map(i=>y(i.category,`${i.basis} · ~${D(i.estimated_tokens_avoided)}`,i.note)).join("")}</div>`:P("No token breakdown has been recorded yet.")}
      </section>

      <section class="kc-panel">
        ${x("Measured Files","Per-file measured usage is only shown when repo-local execution entries carry non-zero token totals.")}
        ${t.measuredUsage.files.length>0?`<div class="kc-stack-list">${t.measuredUsage.files.slice(0,6).map(i=>y(i.file,`${D(i.tokens)} tokens`,`${i.runs} runs · ${i.attribution}`)).join("")}</div>`:P("No measured per-file attribution is available yet.")}
      </section>
    </div>
  `}function _a(e){const t=e.mcpPacks.compatibleCapabilities,n=t.filter(d=>d.trustLevel==="high").length,i=t.filter(d=>d.writeCapable).length,a=t.filter(d=>d.approvalRequired).length,s=e.mcpPacks.selectedPack,o=e.mcpPacks.suggestedPack,l=e.mcpPacks.explicitSelection!==null;return`
    <div class="kc-view-shell">
      <section class="kc-view-header">
        <div>
          <p class="kc-view-kicker">MCP / Tool Integrations</p>
          <h1>${m(s.name??s.id)}</h1>
          <p>${m(s.description)}</p>
        </div>
        ${Y(e.mcpPacks.capabilityStatus,e.mcpPacks.capabilityStatus==="compatible"?"success":"warn")}
      </section>

      <div class="kc-stat-grid">
        ${A("Compatible MCPs",String(t.length),e.mcpPacks.selectedPackSource==="runtime-explicit"?"explicit pack policy":"heuristic pack policy",t.length>0?"success":"warn")}
        ${A("High Trust",String(n),"preferred first",n>0?"success":"neutral")}
        ${A("Write Capable",String(i),"requires judgment",i>0?"warn":"neutral")}
        ${A("Approval Gates",String(a),"extra caution",a>0?"warn":"neutral")}
      </div>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${x("Selected Pack",e.mcpPacks.note)}
          <div class="kc-stack-list">
            ${T("Source",e.mcpPacks.selectedPackSource)}
            ${T("Heuristic default",o.name??o.id)}
            ${T("Executable",e.mcpPacks.executable?"yes":"no")}
          </div>
          ${e.mcpPacks.unavailablePackReason?`<div class="kc-divider"></div><div class="kc-stack-list">${y("Blocked","warn",e.mcpPacks.unavailablePackReason)}</div>`:""}
          <div class="kc-divider"></div>
          <div class="kc-stack-list">
            ${(s.guidance??[]).map(d=>ue(d)).join("")}
          </div>
          <div class="kc-divider"></div>
          <div class="kc-stack-list">
            ${(s.realismNotes??[]).map(d=>y("Reality check","advisory",d)).join("")}
          </div>
          ${l?'<div class="kc-divider"></div><div class="kc-stack-list"><button class="kc-action-button secondary" data-pack-action="clear">Clear explicit pack</button></div>':""}
        </section>
        <section class="kc-panel">
          ${x("Compatible MCP Capabilities","These are the currently compatible MCP integrations for the active repo workflow role and repo profile.")}
          ${t.length>0?`<div class="kc-stack-list">${t.map(d=>Za(d)).join("")}</div>`:P("No compatible MCP integrations are currently exposed for this workflow role and profile.")}
        </section>
      </div>

      <section class="kc-panel">
        ${x("Available Packs","Pack selection is runtime-backed policy. Unavailable packs are blocked until matching integrations are registered.")}
        <div class="kc-fold-grid">
          ${e.mcpPacks.available.map(d=>`
            <details class="kc-fold-card" data-pack-card="true" data-pack-id="${m(d.id)}" ${d.id===s.id?"open":""}>
              <summary>
                <div>
                  <strong>${m(d.name??d.id)}</strong>
                  <span>${m(d.description)}</span>
                </div>
                ${Y(d.id===s.id?"selected":d.executable?"available":"blocked",d.id===s.id?"success":d.executable?"neutral":"warn")}
              </summary>
              <div class="kc-fold-body">
                <div class="kc-stack-list">
                  ${(d.guidance??[]).map(p=>ue(p)).join("")}
                </div>
                <div class="kc-divider"></div>
                <div class="kc-stack-list">
                  ${T("Allowed",d.allowedCapabilityIds.join(", ")||"none")}
                  ${T("Preferred",d.preferredCapabilityIds.join(", ")||"none")}
                  ${d.unavailablePackReason?y("Blocked","warn",d.unavailablePackReason):""}
                </div>
                <div class="kc-divider"></div>
                <div class="kc-stack-list">
                  ${d.id===s.id?y("Selected","success",e.mcpPacks.selectedPackSource==="runtime-explicit"?"Explicit runtime selection is active.":"Heuristic default is active."):d.executable?`<button class="kc-action-button" data-pack-action="set" data-pack-id="${m(d.id)}">Select pack</button>`:`<button class="kc-action-button secondary" data-pack-action="blocked" data-pack-id="${m(d.id)}" disabled>${m(d.unavailablePackReason??"Unavailable")}</button>`}
                </div>
              </div>
            </details>
          `).join("")}
        </div>
      </section>
    </div>
  `}function ja(e){var a;const t=e.kiwiControl??B,n=t.tokenAnalytics,i=[];if(On(t.contextView.task)?i.push({title:"Replace the placeholder task",metric:"task is too broad",note:"The current task label is generic, so Kiwi leans on repo-context and recent-file signals. Preparing with a real goal narrows the selected tree and usually lowers token estimates."}):n.estimationMethod?i.push({title:"Narrow the working set",metric:`${n.fileCountSelected}/${n.fileCountTotal} files`,note:"Use Include, Exclude, and Ignore in Context or Graph to shrink the selected tree before execution. Those tree changes are what alter the next token estimate."}):i.push({title:"Generate a bounded estimate",metric:"prepare first",note:"Run kc prepare with the actual task goal so Kiwi can record a selected working set before showing reduction guidance."}),i.push({title:"Tree drives token estimates",metric:`${t.contextView.tree.selectedCount} selected · ${t.contextView.tree.excludedCount} excluded`,note:"The graph is a projection of the tree. If a file stays selected in the tree, it still counts toward the working-set estimate."}),i.push({title:"Index reuse reduces rescanning",metric:`${t.indexing.indexReusedFiles} reused · ${t.indexing.indexUpdatedFiles} refreshed`,note:"Kiwi reuses index entries when it can and only refreshes changed or newly discovered files. The token estimate is still based on the current selected tree, not random guesses."}),t.wastedFiles.files.length>0&&i.push({title:"Remove wasted files",metric:`~${D(t.wastedFiles.totalWastedTokens)}`,note:`Exclude or ignore ${((a=t.wastedFiles.files[0])==null?void 0:a.file)??"low-value files"} to reduce token use without changing the task goal.`}),t.heavyDirectories.directories.length>0){const s=t.heavyDirectories.directories[0];s&&i.push({title:"Scope the heaviest directory",metric:`${s.percentOfRepo}%`,note:s.suggestion})}return i.push({title:"Understand the tradeoff",metric:n.savingsPercent>0?`~${n.savingsPercent}% saved`:"no savings yet",note:"Smaller context usually lowers tokens and speeds review, but it increases the risk of missing adjacent files or reverse dependents."}),t.measuredUsage.available||i.push({title:"Collect real usage",metric:"estimated only",note:"Measured token usage appears only after local guide, validate, or execution flows record real runs. Until then, the token view is an indexed working-set estimate."}),i}function Oa(e){const t=e.kiwiControl??B,n=t.indexing,i=t.contextTrace.initialSignals;return[{title:"Index coverage",metric:`${n.indexedFiles} indexed · ${n.indexUpdatedFiles} refreshed · ${n.indexReusedFiles} reused`,note:n.coverageNote},{title:"Selection signals",metric:`${n.changedSignals} changed · ${n.importSignals} import · ${n.keywordSignals} keyword · ${n.repoContextSignals} repo`,note:"These are the signal buckets Kiwi used to pull files into the working set."},{title:"Observed tree",metric:`${t.contextView.tree.selectedCount} selected · ${t.contextView.tree.candidateCount} candidate · ${t.contextView.tree.excludedCount} excluded`,note:"The repo tree is built from the current context-selection artifact. Selected files are in-scope, candidate files were considered, and excluded files were filtered out."},{title:"Initial evidence",metric:`${i.changedFiles.length} changed · ${i.importNeighbors.length} import neighbors · ${i.keywordMatches.length} keyword matches`,note:"Before Kiwi expands scope, it starts from changed files, import neighbors, keyword matches, recent files, and repo-context files."}]}function Va(e,t){var i;const n=((i=e.kiwiControl)==null?void 0:i.indexing)??B.indexing;return[{title:"Source of truth",metric:"context tree",note:"This graph is drawn from the current selected/candidate/excluded tree. It is not a full semantic code graph or call graph."},{title:"Visible projection",metric:`${t.nodes.length} nodes · ${t.edges.length} links`,note:`Depth ${se} controls how much of the current tree projection is visible from the repo root.`},{title:"Highlight behavior",metric:"dependency chain when available",note:"When Kiwi has a structural dependency chain for a file, it highlights that path. Otherwise it falls back to the ancestor path in the tree."},{title:"Indexed evidence behind the map",metric:`${n.changedSignals} changed · ${n.importSignals} import · ${n.keywordSignals} keyword`,note:"Those index signals decide which files appear in the working set before the graph turns them into a visual map."}]}function Ba(e){var n;const t=((n=e.kiwiControl)==null?void 0:n.contextView.tree)??B.contextView.tree;return[{title:"Selected",metric:String(t.selectedCount),note:"Selected files are the current bounded working set. They drive validation expectations and token estimates."},{title:"Candidate",metric:String(t.candidateCount),note:"Candidate files were considered relevant enough to surface, but are not currently in the selected working set."},{title:"Excluded",metric:String(t.excludedCount),note:"Excluded files were filtered by the selector. Local Include/Exclude/Ignore UI edits are session-local until a real CLI command rewrites repo state."}]}function za(e){const t=e.kiwiControl??B,n=t.tokenAnalytics;return[{title:"Estimate basis",metric:n.estimationMethod??"heuristic only",note:n.estimateNote??"Kiwi is using the indexed working set to estimate token volume."},{title:"Tree to token path",metric:`${t.contextView.tree.selectedCount} selected files`,note:"The selected tree is the direct input to the working-set token estimate. Excluding a file from the tree is what reduces the next estimate."},{title:"Measured vs estimated",metric:t.measuredUsage.available?`${D(t.measuredUsage.totalTokens)} measured`:"estimate only",note:t.measuredUsage.available?t.measuredUsage.note:"No local execution runs have recorded measured usage yet, so the token numbers are derived from the current indexed tree."},{title:"Index churn",metric:`${t.indexing.indexReusedFiles} reused · ${t.indexing.indexUpdatedFiles} refreshed`,note:"Kiwi does not blindly rescan everything every time. It reuses indexed entries when possible, then recomputes token estimates from the current selected tree."}]}function Ua(e){var i;const t=e.specialists.activeProfile,n=e.specialists.recommendedProfile;return`
    <div class="kc-view-shell">
      <section class="kc-view-header">
        <div>
          <p class="kc-view-kicker">Specialists</p>
          <h1>${m((t==null?void 0:t.name)??e.specialists.activeSpecialist)}</h1>
          <p>${m((t==null?void 0:t.purpose)??"Specialist routing is derived from repo-local role hints, task type, and file area.")}</p>
        </div>
        ${Y((t==null?void 0:t.riskPosture)??"active",(t==null?void 0:t.riskPosture)==="conservative"?"success":"neutral")}
      </section>

      <div class="kc-stat-grid">
        ${A("Active",(t==null?void 0:t.name)??e.specialists.activeSpecialist,"current role fit","neutral")}
        ${A("Recommended",(n==null?void 0:n.name)??e.specialists.recommendedSpecialist,"best next handoff","success")}
        ${A("Targets",String(e.specialists.handoffTargets.length),"handoff candidates","neutral")}
        ${A("Preferred Tools",String(((i=t==null?void 0:t.preferredTools)==null?void 0:i.length)??0),"active specialist","neutral")}
      </div>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${x("Active Specialist","The role currently shaping the workspace and compatible capability set.")}
          ${t?hn(t):P("No active specialist is currently recorded.")}
        </section>
        <section class="kc-panel">
          ${x("Routing Safety",e.specialists.safeParallelHint)}
          <div class="kc-stack-list">
            ${y("Current role",e.specialists.activeSpecialist,(t==null?void 0:t.purpose)??"No active specialist profile is available.")}
            ${y("Recommended next",e.specialists.recommendedSpecialist,(n==null?void 0:n.purpose)??"No recommended specialist profile is available.")}
            ${y("Handoff targets",`${e.specialists.handoffTargets.length}`,e.specialists.safeParallelHint)}
          </div>
        </section>
      </div>

      <section class="kc-panel">
        ${x("Specialist Catalog","Available specialists for the current profile, including their role and risk posture.")}
        <div class="kc-fold-grid">
          ${(e.specialists.available??[]).map(a=>`
            <details class="kc-fold-card" ${a.specialistId===e.specialists.activeSpecialist?"open":""}>
              <summary>
                <div>
                  <strong>${m(a.name??a.specialistId)}</strong>
                  <span>${m(a.purpose??"No purpose recorded.")}</span>
                </div>
                ${Y(a.riskPosture??"neutral",a.specialistId===e.specialists.activeSpecialist?"success":"neutral")}
              </summary>
              <div class="kc-fold-body">
                ${hn(a)}
              </div>
            </details>
          `).join("")}
        </div>
      </section>
    </div>
  `}function Ga(e){var S;const t=e.kiwiControl??B,n=Math.max(0,t.execution.totalExecutions-Math.round(t.execution.successRate/100*t.execution.totalExecutions)),i=ns(e),a=t.workflow.steps.filter(r=>r.status==="success").length,s=t.workflow.steps.find(r=>r.status==="failed")??null,o=it(e,"execution-plan"),l=it(e,"workflow"),d=it(e,"runtime-lifecycle"),p=it(e,"decision-logic");return`
    <div class="kc-view-shell">
      <section class="kc-view-header">
        <div>
          <p class="kc-view-kicker">System State</p>
          <h1>System visibility</h1>
          <p>Execution health, indexing coverage, adaptive learning, and repo-control operating signals.</p>
        </div>
        ${Y(t.execution.tokenTrend,t.execution.tokenTrend==="improving"?"success":t.execution.tokenTrend==="worsening"?"warn":"neutral")}
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
          ${x("Indexing & Structure",t.indexing.coverageNote)}
          <div class="kc-info-grid">
            ${T("Observed files",String(t.indexing.observedFiles))}
            ${T("Discovered files",String(t.indexing.discoveredFiles))}
            ${T("Indexed files",String(t.indexing.indexedFiles))}
            ${T("Impact files",String(t.indexing.impactFiles))}
            ${T("Visited directories",String(t.indexing.visitedDirectories))}
            ${T("Max depth",String(t.indexing.maxDepthExplored))}
            ${T("Changed signals",String(t.indexing.changedSignals))}
            ${T("Repo-context signals",String(t.indexing.repoContextSignals))}
          </div>
          <div class="kc-divider"></div>
          <div class="kc-inline-badges">
            ${K(t.indexing.fileBudgetReached?"file budget limited":"file budget clear")}
            ${K(t.indexing.directoryBudgetReached?"dir budget limited":"dir budget clear")}
            ${K(`scope: ${t.indexing.scopeArea??"unknown"}`)}
          </div>
        </section>
        <section class="kc-panel">
          ${x("Execution Health","Real runtime accounting from repo-local execution history.")}
          ${i.length>0?`<div class="kc-timeline">${i.slice(0,5).map(r=>`
                <article class="kc-timeline-item">
                  <div class="kc-timeline-marker ${r.tone}">
                    ${r.icon}
                  </div>
                  <div class="kc-timeline-copy">
                    <div class="kc-timeline-head">
                      <strong>${m(r.title)}</strong>
                      <span>${m(r.timestamp)}</span>
                    </div>
                    <p>${m(r.detail)}</p>
                  </div>
                </article>
              `).join("")}</div>`:P("No execution history has been recorded yet.")}
        </section>
      </div>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${x("Task Lifecycle",`A runtime-derived lifecycle snapshot from prepare to packet generation, checkpoint, and handoff. ${d}`)}
          <div class="kc-stack-list">
            ${y("Current stage",e.executionState.lifecycle,e.executionState.reason??e.readiness.detail)}
            ${y("Validation",t.runtimeLifecycle.validationStatus??"unknown",t.runtimeLifecycle.nextSuggestedCommand??"No suggested command is recorded yet.")}
            ${y("Task",t.runtimeLifecycle.currentTask??"none recorded",((S=t.runtimeLifecycle.recentEvents[0])==null?void 0:S.summary)??"No lifecycle events are recorded yet.")}
          </div>
        </section>
        <section class="kc-panel">
          ${x("Waste & Weight","Files and directories that inflate scope without helping the task.")}
          ${t.wastedFiles.files.length>0?`<div class="kc-stack-list">${t.wastedFiles.files.slice(0,4).map(r=>y(r.file,`${D(r.tokens)} tokens`,r.reason)).join("")}</div>`:P("No wasted files are recorded in the current selection.")}
        </section>
        <section class="kc-panel">
          ${x("Heavy Directories","Areas that dominate estimated token volume and deserve tighter scoping.")}
          ${t.heavyDirectories.directories.length>0?`<div class="kc-stack-list">${t.heavyDirectories.directories.slice(0,4).map(r=>y(r.directory,`${r.percentOfRepo}%`,r.suggestion)).join("")}</div>`:P("No heavy-directory signal is recorded for this repo yet.")}
        </section>
      </div>

      <section class="kc-panel">
        ${x("Next Commands",`Exact CLI commands from the runtime-derived execution plan. ${o}`)}
        ${t.executionPlan.nextCommands.length>0?_e(t.executionPlan.nextCommands):P("No next commands are currently recorded.")}
      </section>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${x("Workflow Steps",`Runtime-derived workflow snapshot for the active task. ${l}`)}
          <div class="kc-inline-badges">
            ${K(`${a}/${t.workflow.steps.length} successful`)}
            ${K(s?`failed: ${s.action}`:"no failed step")}
          </div>
          ${s!=null&&s.failureReason?`<div class="kc-divider"></div>${y("Failure reason",s.action,s.failureReason)}`:""}
          ${t.workflow.steps.length>0?`<div class="kc-stack-list">${t.workflow.steps.map(r=>y(`${r.action}`,`${r.status}${r.retryCount>0?` · retry ${r.retryCount}`:""}${r.attemptCount>0?` · attempt ${r.attemptCount}`:""}`,r.failureReason??r.result.summary??r.validation??r.expectedOutput??r.result.suggestedFix??r.tokenUsage.note)).join("")}</div>`:P("No workflow state has been recorded yet.")}
        </section>
        <section class="kc-panel">
          ${x("Execution Trace","What executed, which files were used, which skills applied, and token usage per step.")}
          ${t.executionTrace.steps.length>0?`<div class="kc-stack-list">${t.executionTrace.steps.map(r=>y(r.action,r.tokenUsage.source==="none"?`${r.status}${r.retryCount>0?` · retry ${r.retryCount}`:""}`:`${r.status}${r.retryCount>0?` · retry ${r.retryCount}`:""} · ${r.tokenUsage.measuredTokens!=null?D(r.tokenUsage.measuredTokens):`~${D(r.tokenUsage.estimatedTokens??0)}`}`,r.failureReason?`${r.failureReason}${r.files.length>0?` | files: ${r.files.slice(0,3).join(", ")}`:""}`:`${r.result.summary??(r.files.slice(0,3).join(", ")||"no files")}${r.skillsApplied.length>0?` | skills: ${r.skillsApplied.join(", ")}`:""}${r.result.validation?` | validation: ${r.result.validation}`:r.expectedOutput?` | expects: ${r.expectedOutput}`:""}${r.result.retryCommand?` | retry: ${r.result.retryCommand}`:""}`)).join("")}</div>`:P("No execution trace is available yet.")}
        </section>
      </div>

      <section class="kc-panel">
        ${x("DECISION LOGIC",`Runtime-derived decision snapshot showing which signals won and which signals were intentionally ignored. ${p}`)}
        <div class="kc-two-column">
          <section class="kc-subpanel">
            ${x("Reasoning chain",t.decisionLogic.summary||"No decision summary recorded.")}
            ${t.decisionLogic.reasoningChain.length>0?`<div class="kc-stack-list">${t.decisionLogic.reasoningChain.map(r=>ue(r)).join("")}</div>`:P("No reasoning chain is available yet.")}
          </section>
          <section class="kc-subpanel">
            ${x("Ignored signals","Signals Kiwi saw but did not let dominate the next action.")}
            ${t.decisionLogic.ignoredSignals.length>0?`<div class="kc-stack-list">${t.decisionLogic.ignoredSignals.map(r=>ue(r)).join("")}</div>`:P("No ignored signals are currently recorded.")}
          </section>
        </div>
      </section>

      <section class="kc-panel">
        ${x("Runtime Events",`Hook-style events emitted by Kiwi’s lightweight runtime integration. ${d}`)}
        ${t.runtimeLifecycle.recentEvents.length>0?`<div class="kc-stack-list">${t.runtimeLifecycle.recentEvents.slice(0,6).map(r=>y(`${r.type} · ${r.stage}`,r.status,r.summary)).join("")}</div>`:P("No runtime events are recorded yet.")}
      </section>

      <section class="kc-panel">
        ${x("Ecosystem Discovery","Read-only external capability metadata used to inform decisions without executing tools directly.")}
        <div class="kc-two-column">
          <section class="kc-subpanel">
            ${x("Known tools","Selected tools and ecosystems from Awesome Copilot and Awesome Claude Code.")}
            <div class="kc-stack-list">
              ${e.ecosystem.tools.slice(0,5).map(r=>y(r.name,r.category,r.description)).join("")}
            </div>
          </section>
          <section class="kc-subpanel">
            ${x("Known workflows","Advisory workflow patterns only.")}
            <div class="kc-stack-list">
              ${e.ecosystem.workflows.slice(0,4).map(r=>y(r.name,r.source,r.description)).join("")}
            </div>
          </section>
        </div>
      </section>
    </div>
  `}function Ka(e){return vi({state:e,activeMode:$e,helpers:et()})}function it(e,t){const n=e.derivedFreshness.find(i=>i.outputName===t);return n?`Compatibility/debug snapshot${n.sourceRevision!=null?` · revision ${n.sourceRevision}`:""}${n.generatedAt?` · generated ${n.generatedAt}`:""}.`:"Compatibility/debug snapshot."}function Wa(e){const n=(e.kiwiControl??B).feedback;return`
    <div class="kc-view-shell">
      <section class="kc-view-header">
        <div>
          <p class="kc-view-kicker">Feedback</p>
          <h1>${m(n.adaptationLevel==="active"?"Adaptive feedback is active":"Adaptive feedback is limited")}</h1>
          <p>${m(n.note)}</p>
        </div>
        ${Y(`${n.totalRuns} runs`,n.adaptationLevel==="active"?"success":"neutral")}
      </section>

      <div class="kc-stat-grid">
        ${A("Valid Runs",String(n.totalRuns),"successful completions","neutral")}
        ${A("Success Rate",`${n.successRate}%`,"repo-local",n.successRate>=80?"success":"neutral")}
        ${A("Boosted",String(n.topBoostedFiles.length),"task-scope files","success")}
        ${A("Penalized",String(n.topPenalizedFiles.length),"task-scope files","warn")}
      </div>

      <div class="kc-two-column">
        <section class="kc-panel">
          ${x("Boosted Files","Files that improved successful runs in this task scope.")}
          ${n.topBoostedFiles.length>0?`<div class="kc-stack-list">${n.topBoostedFiles.map(i=>fn(i.file,i.score,"success")).join("")}</div>`:P("No boosted files are recorded yet.")}
        </section>
        <section class="kc-panel">
          ${x("Penalized Files","Files Kiwi Control is learning to avoid for this task scope.")}
          ${n.topPenalizedFiles.length>0?`<div class="kc-stack-list">${n.topPenalizedFiles.map(i=>fn(i.file,i.score,"warn")).join("")}</div>`:P("No penalized files are recorded yet.")}
        </section>
      </div>

      <section class="kc-panel">
        ${x("Recent Completions","Only valid successful completions train future selection behavior.")}
        ${n.recentEntries.length>0?`<div class="kc-stack-list">${n.recentEntries.map(i=>`
              <div class="kc-note-row">
                <div>
                  <strong>${m(i.task)}</strong>
                  <span>${m(`${i.filesUsed}/${i.filesSelected} files used · ${ce(i.timestamp)}`)}</span>
                </div>
                ${Y(i.success?"success":"fail",i.success?"success":"warn")}
              </div>
            `).join("")}</div>`:P("No recent feedback events are available yet.")}
      </section>

      <section class="kc-panel">
        ${x("Retrieval Reuse","When Kiwi reuses a successful pattern, it still falls back to fresh selection if similarity is weak.")}
        ${n.basedOnPastRuns?`<div class="kc-stack-list">
              ${y("reused pattern",n.reusedPattern??"similar work",n.note)}
              ${n.similarTasks.slice(0,4).map(i=>y(i.task,`similarity ${i.similarity}`,ce(i.timestamp))).join("")}
            </div>`:P("Current selection is not based on past runs strongly enough to reuse a prior pattern.")} 
      </section>
    </div>
  `}function qa(e){e.kiwiControl;const t=E,n=t?Mt.get(t.id)??"unmarked":"unmarked";return hi({...ki({state:e,focusedItem:t,marker:n,activeMode:$e,commandState:v,resolveFocusedStep:i=>(i==null?void 0:i.kind)==="step"?Je(e).find(a=>a.id===i.id)??null:null,resolveFocusedNode:i=>(i==null?void 0:i.kind)==="path"?jn(e,i.path):null}),helpers:{...et(),renderGateRow:Yn,renderBulletRow:ue}})}function Ya(e){var n;const t=Je(e);return pi({...{state:e,steps:t,editingPlanStepId:je,editingPlanDraft:ye,focusedItem:E,commandState:v,failureGuidance:ii(((n=e.kiwiControl)==null?void 0:n.executionPlan.lastError)??null)},helpers:{escapeHtml:m,escapeAttribute:Ut,formatCliCommand:_,renderPanelHeader:x,renderInlineBadge:K,renderNoteRow:y,renderEmptyState:P,renderHeaderBadge:Y}})}function Ja(e){const t=is(e),n=(e.kiwiControl??B).execution.recentExecutions;return`
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
        ${$e==="execution"?n.length>0?n.slice(0,6).map(i=>`
                <div class="kc-log-line ${i.success?"":"is-warn"}">
                  <span>${m(i.success?"run":"failed")}</span>
                  <strong>${m(`${i.task} · ${i.filesTouched} files · ~${D(i.tokensUsed)} tokens · ${ce(i.timestamp)}`)}</strong>
                </div>
              `).join(""):P("No execution history is recorded yet."):Te==="validation"?Xa(e.validation):Te==="history"?n.length>0?n.map(i=>`
                  <div class="kc-log-line ${i.success?"":"is-warn"}">
                    <span>${m(i.success?"run":"failed")}</span>
                    <strong>${m(`${i.task} · ${i.filesTouched} files · ~${D(i.tokensUsed)} tokens · ${ce(i.timestamp)}`)}</strong>
                  </div>
                `).join(""):P("No execution history is recorded yet."):t.length>0?t.map(i=>`
                <div class="kc-log-line">
                  <span>${m(i.label)}</span>
                  <strong>${m(i.value)}</strong>
                </div>
              `).join(""):P("No repo activity is recorded yet.")}
      </div>
    </div>
  `}function Xa(e){const t=e.issues??[];return t.length===0?'<div class="kc-log-line"><span>info</span><strong>Repo validation is currently passing.</strong></div>':t.map(n=>`
    <div class="kc-log-line ${n.level==="error"?"is-error":n.level==="warn"?"is-warn":""}">
      <span>${m(n.level)}</span>
      <strong>${m(`${n.filePath?`${n.filePath}: `:""}${n.message}`)}</strong>
    </div>
  `).join("")}function A(e,t,n,i){return`
    <article class="kc-stat-card tone-${i}">
      <span>${m(e)}</span>
      <strong>${m(t)}</strong>
      <em>${m(n)}</em>
    </article>
  `}function wt(e,t){return`
    <div class="kc-small-metric">
      <strong>${m(e)}</strong>
      <span>${m(t)}</span>
    </div>
  `}function x(e,t){return`
    <header class="kc-panel-header">
      <div>
        <p>${m(e)}</p>
        <h3>${m(e)}</h3>
      </div>
      <span>${m(t)}</span>
    </header>
  `}function T(e,t,n="default"){return`
    <div class="kc-info-row">
      <span>${m(e)}</span>
      <strong class="${n==="warn"?"is-warn":""}">${m(t)}</strong>
    </div>
  `}function Qa(e){const t=e.toLowerCase();return t.includes("low confidence")?"May miss relevant files or choose the wrong working set.":t.includes("partial scan")?"Repo understanding may be incomplete until context expands.":t.includes("changed files")?"Recent edits can dominate the plan and change the safest next step.":t.includes("reverse depend")?"Downstream breakage can be missed if structural dependents are ignored.":t.includes("keyword")?"Task matching may drift away from the user’s actual request.":t.includes("repo context")?"Repo-local authority and critical files may be skipped.":"Ignoring this signal can reduce decision quality or hide relevant files."}function Y(e,t){return`<span class="kc-badge badge-${m(t==="bridge-unavailable"||t==="low"?"warn":t==="medium"?"neutral":t==="high"?"success":t)}">${m(e)}</span>`}function Yn(e,t,n){return`
    <div class="kc-info-row kc-gate-row">
      <span>${m(e)}</span>
      <strong class="${n==="warn"?"is-warn":n==="success"?"is-success":""}">${m(t)}</strong>
    </div>
  `}function Ae(e,t,n,i="data-validation-tab"){return`<button class="kc-tab-button ${e===t?"is-active":""}" type="button" ${i}="${m(e)}">${m(n)}</button>`}function _e(e){return`<div class="kc-inline-badges">${e.map(t=>`<span class="kc-inline-badge">${m(t)}</span>`).join("")}</div>`}function K(e){return`<span class="kc-inline-badge">${m(e)}</span>`}function lt(e,t){return`<span class="kc-inline-badge ${t?"is-active":"is-muted"}">${m(e)}</span>`}function ue(e){return`
    <div class="kc-bullet-row">
      <span class="kc-bullet-dot"></span>
      <span>${m(e)}</span>
    </div>
  `}function Za(e){return`
    <article class="kc-capability-card">
      <div class="kc-capability-head">
        <div>
          <strong>${m(e.id)}</strong>
          <span>${m(e.category)}</span>
        </div>
        ${Y(e.trustLevel,e.trustLevel==="high"?"success":e.trustLevel==="low"?"warn":"neutral")}
      </div>
      <p>${m(e.purpose)}</p>
      <div class="kc-inline-badges">
        ${K(e.readOnly?"read only":"read write")}
        ${K(e.writeCapable?"write capable":"no writes")}
        ${K(e.approvalRequired?"approval required":"self-serve")}
      </div>
      ${e.usageGuidance.length>0?`<div class="kc-capability-notes">${e.usageGuidance.slice(0,2).map(ue).join("")}</div>`:""}
    </article>
  `}function hn(e){return`
    <div class="kc-stack-list">
      <div class="kc-note-row">
        <div>
          <strong>${m(e.name??e.specialistId)}</strong>
          <span>${m(e.purpose??"No purpose recorded.")}</span>
        </div>
        <em>${m(e.riskPosture??"unknown")}</em>
      </div>
      <div class="kc-inline-badges">
        ${K(`id: ${e.specialistId}`)}
        ${K(`tools: ${(e.preferredTools??[]).join(", ")||"none"}`)}
        ${K(`aliases: ${(e.aliases??[]).join(", ")||"none"}`)}
      </div>
    </div>
  `}function fn(e,t,n){return`
    <div class="kc-score-row">
      <span>${m(e)}</span>
      <strong class="tone-${n}">${t>0?`+${t}`:`${t}`}</strong>
    </div>
  `}function es(e,t,n,i){const a=n>0?Math.max(6,Math.round(t/n*100)):6;return`
    <div class="kc-bar-row">
      <div class="kc-bar-copy">
        <strong>${m(e)}</strong>
        <span>${m(`${D(t)} · ${i}`)}</span>
      </div>
      <div class="kc-bar-track"><div class="kc-bar-fill" style="width: ${a}%"></div></div>
    </div>
  `}function y(e,t,n){return`
    <div class="kc-note-row">
      <div>
        <strong>${m(e)}</strong>
        <span>${m(n)}</span>
      </div>
      <em>${m(t)}</em>
    </div>
  `}function gn(e,t,n){if(n<=0)return"";const i=Math.max(0,Math.min(100,Math.round(t/n*100)));return`
    <div class="kc-meter-row">
      <div class="kc-meter-copy">
        <span>${m(e)}</span>
        <strong>${i}%</strong>
      </div>
      <div class="kc-meter-track"><div class="kc-meter-fill" style="width: ${i}%"></div></div>
    </div>
  `}function ts(e){return`
    <article class="kc-issue-card issue-${m(e.level)}">
      <div>
        <strong>${m(e.filePath??"repo contract")}</strong>
        <span>${m(e.message)}</span>
      </div>
      ${Y(e.level,e.level==="error"?"critical":"warn")}
    </article>
  `}function P(e){return`<p class="kc-empty-state">${m(e)}</p>`}function Jn(e){return ui({tree:e,focusedItem:E,contextOverrides:de,helpers:{escapeHtml:m,escapeAttribute:Ut,renderEmptyState:P}})}function ns(e){const t=e.kiwiControl??B,n=[];for(const o of t.execution.recentExecutions)n.push({title:o.success?"Execution completed":"Execution failed",detail:`${o.task} · ${o.filesTouched} files touched`,timestamp:ce(o.timestamp),tone:o.success?"tone-success":"tone-warn",icon:o.success?F("check"):F("alert"),...o.tokensUsed>0?{meta:[`~${D(o.tokensUsed)} tokens`]}:{}});for(const o of t.runtimeLifecycle.recentEvents.slice(0,4))n.push({title:`Runtime ${o.type}`,detail:o.summary,timestamp:ce(o.timestamp),tone:o.status==="error"?"tone-warn":o.status==="warn"?"tone-neutral":"tone-success",icon:o.status==="error"?F("alert"):o.status==="warn"?F("system"):F("check"),...o.files.length>0?{meta:o.files.slice(0,3)}:{}});const i=be(e.continuity,"Latest checkpoint");i!=="none recorded"&&n.push({title:"Checkpoint updated",detail:i,timestamp:"repo-local",tone:"tone-neutral",icon:F("checkpoint")});const a=be(e.continuity,"Latest handoff");a!=="none recorded"&&n.push({title:"Handoff available",detail:a,timestamp:"repo-local",tone:"tone-neutral",icon:F("handoffs")});const s=be(e.continuity,"Latest reconcile");return s!=="none recorded"&&n.push({title:"Reconcile state updated",detail:s,timestamp:"repo-local",tone:"tone-neutral",icon:F("activity")}),n.slice(0,8)}function is(e){return[...(e.kiwiControl??B).execution.recentExecutions.map(i=>({label:i.success?"run":"run failed",value:`${i.task} · ${i.filesTouched} files · ${ce(i.timestamp)}`})),...e.continuity.slice(0,3).map(i=>({label:i.label,value:i.value}))].slice(0,8)}function Xn(e,t){return`<span class="kc-icon-label">${e}<em>${m(t)}</em></span>`}function F(e){const t='viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';switch(e){case"overview":return`<svg ${t}><rect x="3" y="4" width="7" height="7"/><rect x="14" y="4" width="7" height="7"/><rect x="3" y="13" width="7" height="7"/><rect x="14" y="13" width="7" height="7"/></svg>`;case"context":return`<svg ${t}><path d="M4 19V5h16v14Z"/><path d="M8 9h8"/><path d="M8 13h5"/></svg>`;case"graph":return`<svg ${t}><circle cx="12" cy="12" r="2"/><circle cx="6" cy="7" r="2"/><circle cx="18" cy="7" r="2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/><path d="M10.5 10.5 7.5 8.5"/><path d="m13.5 10.5 3-2"/><path d="m10.8 13.4-2.5 3"/><path d="m13.2 13.4 2.5 3"/></svg>`;case"validation":return`<svg ${t}><path d="M12 3 4 7v6c0 4.5 3.2 6.9 8 8 4.8-1.1 8-3.5 8-8V7Z"/><path d="m9 12 2 2 4-4"/></svg>`;case"activity":return`<svg ${t}><path d="M3 12h4l2-4 4 8 2-4h6"/></svg>`;case"tokens":return`<svg ${t}><circle cx="12" cy="12" r="8"/><path d="M9 12h6"/><path d="M12 9v6"/></svg>`;case"handoffs":return`<svg ${t}><path d="m7 7 5-4 5 4"/><path d="M12 3v14"/><path d="m17 17-5 4-5-4"/></svg>`;case"feedback":return`<svg ${t}><path d="M12 3v6"/><path d="m15 12 6-3"/><path d="m9 12-6-3"/><path d="m15 15 4 4"/><path d="m9 15-4 4"/><circle cx="12" cy="12" r="3"/></svg>`;case"mcps":return`<svg ${t}><path d="M4 12h16"/><path d="M12 4v16"/><path d="m6.5 6.5 11 11"/><path d="m17.5 6.5-11 11"/></svg>`;case"specialists":return`<svg ${t}><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/></svg>`;case"system":return`<svg ${t}><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 4v16"/><path d="M15 4v16"/><path d="M4 9h16"/><path d="M4 15h16"/></svg>`;case"logs-open":return`<svg ${t}><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h10"/><path d="m19 15-3 3 3 3"/></svg>`;case"logs-closed":return`<svg ${t}><path d="M4 6h16"/><path d="M4 12h10"/><path d="M4 18h16"/><path d="m15 9 3 3-3 3"/></svg>`;case"panel-open":return`<svg ${t}><rect x="3" y="4" width="18" height="16"/><path d="M15 4v16"/></svg>`;case"panel-closed":return`<svg ${t}><rect x="3" y="4" width="18" height="16"/><path d="M9 4v16"/></svg>`;case"close":return`<svg ${t}><path d="m6 6 12 12"/><path d="m18 6-12 12"/></svg>`;case"refresh":return`<svg ${t}><path d="M20 11a8 8 0 0 0-14.9-3"/><path d="M4 4v5h5"/><path d="M4 13a8 8 0 0 0 14.9 3"/><path d="M20 20v-5h-5"/></svg>`;case"check":return`<svg ${t}><path d="m5 12 4 4 10-10"/></svg>`;case"alert":return`<svg ${t}><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/></svg>`;case"checkpoint":return`<svg ${t}><path d="M6 4h12v6H6z"/><path d="M9 10v10"/><path d="M15 10v10"/></svg>`;case"sun":return`<svg ${t}><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`;case"moon":return`<svg ${t}><path d="M12 3a6 6 0 1 0 9 9A9 9 0 1 1 12 3Z"/></svg>`;default:return`<svg ${t}><circle cx="12" cy="12" r="8"/></svg>`}}function D(e){return e>=1e6?`${(e/1e6).toFixed(1)}M`:e>=1e3?`${(e/1e3).toFixed(1)}K`:String(e)}function as(e){return e.toLocaleString("en-US")}function ss(e){return e==null?"n/a":`${e.toFixed(1)}%`}function os(e){return e==null?"—":`$${e.toFixed(2)}`}function ce(e){if(!e)return"unknown time";const t=new Date(e);return Number.isNaN(t.getTime())?e:t.toLocaleString(void 0,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})}function be(e,t){var n;return((n=e.find(i=>i.label===t))==null?void 0:n.value)??"none recorded"}function Ot(e){if(!e)return"No repo loaded";const t=e.split(/[\\/]/).filter(Boolean);return t[t.length-1]??e}function Vt(e){return Ni(e,R)}function rs(e){switch(e){case"source-bundle":return"local source bundle";case"installed-bundle":return"installed bundle";default:return"fallback launcher"}}function gt(e,t){return Fi(e,t,_t(e))}async function Qn(){if(!j())return null;try{return await W("consume_initial_launch_request")}catch{return null}}async function Zn(e,t=!1){return j()?await W("load_repo_control_state",{targetRoot:e,preferSnapshot:t}):zt(e)}async function Bt(e,t){if(!(!j()||!e))try{await W("set_active_repo_target",{targetRoot:e,revision:t})}catch{}}function zt(e){const t=e.trim().length>0,n=t?e:"";return{targetRoot:n,loadState:{source:"bridge-fallback",freshness:"failed",generatedAt:new Date().toISOString(),snapshotSavedAt:null,snapshotAgeMs:null,detail:t?"Repo-local state could not be loaded from the Kiwi bridge.":"No repo is loaded yet."},profileName:"default",executionMode:"local",projectType:"unknown",repoState:{mode:"bridge-unavailable",title:t?"Could not load this repo yet":"Open a repo",detail:t?"Kiwi Control could not read repo-local state for this folder yet.":"Run kc ui inside a repo to load it automatically.",sourceOfTruthNote:"Repo-local artifacts under .agent/ and promoted repo instruction files remain the source of truth. The desktop app never replaces that state."},executionState:{revision:0,operationId:null,task:null,sourceCommand:null,lifecycle:"failed",reason:t?"Kiwi Control could not read repo-local execution state for this folder yet.":"No repo is loaded yet.",nextCommand:t?"kc ui":"kc init",blockedBy:t?["Repo-local execution state is unavailable."]:[],lastUpdatedAt:null},readiness:{label:t?"Desktop bridge unavailable":"Open a repo",tone:"failed",detail:t?"Kiwi Control could not read repo-local execution state for this folder yet.":"Run kc ui inside a repo to load it automatically.",nextCommand:t?"kc ui":"kc init"},runtimeIdentity:null,derivedFreshness:[],runtimeDecision:{currentStepId:"idle",currentStepLabel:"Idle",currentStepStatus:"failed",nextCommand:t?"kc ui":"kc init",readinessLabel:t?"Desktop bridge unavailable":"Open a repo",readinessTone:"failed",readinessDetail:t?"Kiwi Control could not read repo-local execution state for this folder yet.":"Run kc ui inside a repo to load it automatically.",nextAction:{action:t?"Restore the desktop bridge":"Open a repo",command:t?"kc ui":"kc init",reason:t?"Kiwi Control could not read repo-local execution state for this folder yet.":"Run kc ui inside a repo to load it automatically.",priority:"critical"},recovery:{kind:"failed",reason:t?"Kiwi Control could not read repo-local execution state for this folder yet.":"Run kc ui inside a repo to load it automatically.",fixCommand:t?"kc ui":"kc init",retryCommand:t?"kc ui":"kc init"},decisionSource:"bridge-fallback",updatedAt:new Date().toISOString()},repoOverview:[{label:"Project type",value:t?"unknown (awaiting repo bridge)":"no repo loaded",...t?{tone:"warn"}:{}},{label:"Active role",value:"none recorded"},{label:"Next file",value:t?".agent/project.yaml":"run kc ui inside a repo"},{label:"Next command",value:t?"kc ui":"kc init"},{label:"Validation state",value:t?"bridge unavailable":"waiting for repo",...t?{tone:"warn"}:{}},{label:"Current phase",value:t?"restore repo bridge":"load a repo"}],continuity:[{label:"Latest checkpoint",value:"none recorded"},{label:"Latest handoff",value:"none recorded"},{label:"Latest reconcile",value:"none recorded"},{label:"Current focus",value:t?`reload repo-local state for ${n}`:"open a repo from the CLI"},{label:"Open risks",value:t?"Cannot read repo-local state yet.":"No repo loaded.",tone:"warn"}],memoryBank:[],specialists:{activeSpecialist:"review-specialist",recommendedSpecialist:"review-specialist",activeProfile:null,recommendedProfile:null,handoffTargets:[],safeParallelHint:"Restore repo-local visibility first."},mcpPacks:{selectedPack:{id:"core-pack",description:"Default repo-first pack."},selectedPackSource:"heuristic-default",explicitSelection:null,suggestedPack:{id:"core-pack",description:"Default repo-first pack.",guidance:[],realismNotes:[]},available:[],compatibleCapabilities:[],effectiveCapabilityIds:[],preferredCapabilityIds:[],executable:!1,unavailablePackReason:"Pack selection is unavailable until repo-local state can be loaded.",capabilityStatus:"limited",note:"No compatible MCP integrations are available until repo-local state can be loaded."},validation:{ok:!1,errors:t?1:0,warnings:t?0:1,issues:[]},ecosystem:{artifactType:"kiwi-control/ecosystem-catalog",version:1,timestamp:new Date().toISOString(),tools:[],workflows:[],capabilities:[],notes:["Ecosystem metadata becomes available once repo-local state loads."]},machineAdvisory:{artifactType:"kiwi-control/machine-advisory",version:3,generatedBy:"kiwi-control machine-advisory",windowDays:7,updatedAt:"",stale:!0,sections:{inventory:{status:"partial",updatedAt:"",reason:"Machine-local advisory is unavailable."},mcpInventory:{status:"partial",updatedAt:"",reason:"Machine-local advisory is unavailable."},optimizationLayers:{status:"partial",updatedAt:"",reason:"Machine-local advisory is unavailable."},setupPhases:{status:"partial",updatedAt:"",reason:"Machine-local advisory is unavailable."},configHealth:{status:"partial",updatedAt:"",reason:"Machine-local advisory is unavailable."},usage:{status:"partial",updatedAt:"",reason:"Machine-local advisory is unavailable."},guidance:{status:"partial",updatedAt:"",reason:"Machine-local advisory is unavailable."}},inventory:[],mcpInventory:{claudeTotal:0,codexTotal:0,copilotTotal:0,tokenServers:[]},optimizationLayers:[],setupPhases:[],configHealth:[],skillsCount:0,copilotPlugins:[],usage:{days:7,claude:{available:!1,days:[],totals:{inputTokens:0,outputTokens:0,cacheCreationTokens:0,cacheReadTokens:0,totalTokens:0,totalCost:null,cacheHitRatio:null},note:"Machine-local advisory is unavailable."},codex:{available:!1,days:[],totals:{inputTokens:0,outputTokens:0,cachedInputTokens:0,reasoningOutputTokens:0,sessions:0,totalTokens:0,cacheHitRatio:null},note:"Machine-local advisory is unavailable."},copilot:{available:!1,note:"Machine-local advisory is unavailable."}},optimizationScore:{planning:{label:"planning",score:0,earnedPoints:0,maxPoints:100,activeSignals:[],missingSignals:[]},execution:{label:"execution",score:0,earnedPoints:0,maxPoints:100,activeSignals:[],missingSignals:[]},assistant:{label:"assistant",score:0,earnedPoints:0,maxPoints:100,activeSignals:[],missingSignals:[]}},setupSummary:{installedTools:{readyCount:0,totalCount:0},healthyConfigs:{readyCount:0,totalCount:0},activeTokenLayers:[],readyRuntimes:{planning:!1,execution:!1,assistant:!1}},systemHealth:{criticalCount:0,warningCount:0,okCount:0},guidance:[],note:"Machine-local advisory is unavailable."},kiwiControl:B}}function m(e){return e.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;")}function Ut(e){return m(e)}function j(){return typeof window<"u"&&"__TAURI_INTERNALS__"in window}
