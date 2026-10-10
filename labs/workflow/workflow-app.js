import {
  NODE_TYPES,
  ACTION_OPERATIONS,
  CONDITION_OPERATORS,
  validateWorkflow,
  WorkflowSimulator,
  parseWorkflowJson,
  SAMPLE_WORKFLOWS
} from './workflow-engine.js';

class WorkflowApp {
  constructor() {
    this.STORAGE_KEY = 'it_workflow_current';
    this.workflow = this.loadInitialWorkflow();
    this.selectedNodeId = null;
    this.connectingSource = null; // { nodeId, portType ('out'|'out-true'|'out-false') }
    this.simulator = null;
    this.isDragging = false;
    this.dragTargetNode = null;
    this.dragOffset = { x: 0, y: 0 };

    this.initDOMElements();
    this.bindEvents();
    this.render();
    this.validate();
  }

  loadInitialWorkflow() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        return parseWorkflowJson(saved);
      }
    } catch (e) {
      console.warn('Failed to load saved workflow, using sample', e);
    }
    return JSON.parse(JSON.stringify(SAMPLE_WORKFLOWS.customerSupport));
  }

  saveWorkflow() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.workflow));
      this.showToast('Workflow saved locally');
    } catch (e) {
      this.showToast('Error saving workflow', true);
    }
  }

  initDOMElements() {
    this.canvasViewport = document.getElementById('canvasViewport');
    this.svgLayer = document.getElementById('svgLayer');
    this.nodesContainer = document.getElementById('nodesContainer');
    this.nodeInspector = document.getElementById('nodeInspector');
    this.validationAlerts = document.getElementById('validationAlerts');
    this.simLogContainer = document.getElementById('simLogContainer');
    this.simContextContainer = document.getElementById('simContextContainer');
    this.sampleSelect = document.getElementById('sampleSelect');
  }

  bindEvents() {
    // Toolbar Node Adders
    document.getElementById('btnAddStart')?.addEventListener('click', () => this.addNode(NODE_TYPES.START));
    document.getElementById('btnAddAction')?.addEventListener('click', () => this.addNode(NODE_TYPES.ACTION));
    document.getElementById('btnAddCondition')?.addEventListener('click', () => this.addNode(NODE_TYPES.CONDITION));
    document.getElementById('btnAddEnd')?.addEventListener('click', () => this.addNode(NODE_TYPES.END));

    // Canvas actions
    document.getElementById('btnValidate')?.addEventListener('click', () => this.validate(true));
    document.getElementById('btnSaveWorkflow')?.addEventListener('click', () => this.saveWorkflow());
    document.getElementById('btnResetWorkflow')?.addEventListener('click', () => this.resetCanvas());
    document.getElementById('btnExportJson')?.addEventListener('click', () => this.exportJson());
    document.getElementById('btnImportJson')?.addEventListener('click', () => this.promptImportJson());

    // Samples
    this.sampleSelect?.addEventListener('change', (e) => {
      const key = e.target.value;
      if (SAMPLE_WORKFLOWS[key]) {
        this.workflow = JSON.parse(JSON.stringify(SAMPLE_WORKFLOWS[key]));
        this.selectedNodeId = null;
        this.resetSimulation();
        this.render();
        this.validate();
        this.showToast(`Loaded "${this.workflow.name}" sample`);
      }
    });

    // Simulation Controls
    document.getElementById('btnStartSim')?.addEventListener('click', () => this.startSimulation());
    document.getElementById('btnStepSim')?.addEventListener('click', () => this.stepSimulation());
    document.getElementById('btnRunAllSim')?.addEventListener('click', () => this.runAllSimulation());
    document.getElementById('btnResetSim')?.addEventListener('click', () => this.resetSimulation());

    // Canvas Dragging & Connecting
    this.canvasViewport.addEventListener('mousedown', (e) => this.handleCanvasMouseDown(e));
    window.addEventListener('mousemove', (e) => this.handleWindowMouseMove(e));
    window.addEventListener('mouseup', (e) => this.handleWindowMouseUp(e));

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedNodeId && !['input', 'textarea', 'select'].includes(document.activeElement.tagName.toLowerCase())) {
        this.deleteNode(this.selectedNodeId);
      }
      if (e.key === 'Escape') {
        this.connectingSource = null;
        this.renderConnections();
      }
    });
  }

  addNode(type) {
    const id = 'node_' + Math.random().toString(36).substring(2, 9);
    let label = 'New Step';
    let config = {};

    // Center node relative to current scroll
    const scrollX = this.canvasViewport.parentElement.scrollLeft || 0;
    const scrollY = this.canvasViewport.parentElement.scrollTop || 0;
    const x = scrollX + 220 + Math.floor(Math.random() * 40);
    const y = scrollY + 160 + Math.floor(Math.random() * 40);

    if (type === NODE_TYPES.START) {
      label = 'Event Trigger';
    } else if (type === NODE_TYPES.ACTION) {
      label = 'Process Action';
      config = { actionType: ACTION_OPERATIONS.SET_VARIABLE, paramKey: 'status', paramValue: 'processed' };
    } else if (type === NODE_TYPES.CONDITION) {
      label = 'Decision Rule';
      config = { field: 'status', operator: CONDITION_OPERATORS.EQUALS, value: 'processed' };
    } else if (type === NODE_TYPES.END) {
      label = 'Finish Outcome';
    }

    const newNode = { id, type, label, description: '', config, x, y };
    this.workflow.nodes.push(newNode);
    this.selectedNodeId = id;
    this.render();
    this.validate();
    this.showToast(`Added ${type} node`);
  }

  deleteNode(nodeId) {
    this.workflow.nodes = this.workflow.nodes.filter(n => n.id !== nodeId);
    this.workflow.edges = this.workflow.edges.filter(e => e.from !== nodeId && e.to !== nodeId);
    if (this.selectedNodeId === nodeId) {
      this.selectedNodeId = null;
    }
    this.render();
    this.validate();
    this.showToast('Node deleted');
  }

  deleteEdge(edgeId) {
    this.workflow.edges = this.workflow.edges.filter(e => e.id !== edgeId);
    this.renderConnections();
    this.validate();
    this.showToast('Connection removed');
  }

  selectNode(nodeId) {
    this.selectedNodeId = nodeId;
    this.renderNodes();
    this.renderInspector();
  }

  handleCanvasMouseDown(e) {
    const nodeEl = e.target.closest('.wf-node');
    const portEl = e.target.closest('.wf-port');

    if (portEl) {
      e.stopPropagation();
      const nodeId = portEl.getAttribute('data-node-id');
      const portType = portEl.getAttribute('data-port-type');

      if (portType === 'in') {
        if (this.connectingSource && this.connectingSource.nodeId !== nodeId) {
          this.createEdge(this.connectingSource.nodeId, nodeId, this.connectingSource.branch);
          this.connectingSource = null;
          this.renderConnections();
          this.validate();
        }
      } else {
        // Output port clicked
        const branch = portType === 'out-true' ? 'true' : (portType === 'out-false' ? 'false' : 'default');
        this.connectingSource = { nodeId, branch };
        this.showToast(`Connecting from ${branch} port... click an input port on target node.`);
      }
      return;
    }

    if (nodeEl) {
      const nodeId = nodeEl.getAttribute('data-id');
      this.selectNode(nodeId);
      this.isDragging = true;
      this.dragTargetNode = this.workflow.nodes.find(n => n.id === nodeId);
      const rect = nodeEl.getBoundingClientRect();
      this.dragOffset = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
      e.stopPropagation();
      return;
    }

    // Clicked empty canvas
    this.selectedNodeId = null;
    this.connectingSource = null;
    this.renderNodes();
    this.renderInspector();
  }

  handleWindowMouseMove(e) {
    if (this.isDragging && this.dragTargetNode) {
      const canvasRect = this.canvasViewport.getBoundingClientRect();
      const newX = Math.max(20, Math.min(2200, e.clientX - canvasRect.left - this.dragOffset.x));
      const newY = Math.max(20, Math.min(1400, e.clientY - canvasRect.top - this.dragOffset.y));
      this.dragTargetNode.x = Math.round(newX);
      this.dragTargetNode.y = Math.round(newY);

      const el = document.querySelector(`.wf-node[data-id="${this.dragTargetNode.id}"]`);
      if (el) {
        el.style.left = `${this.dragTargetNode.x}px`;
        el.style.top = `${this.dragTargetNode.y}px`;
      }
      this.renderConnections();
    }
  }

  handleWindowMouseUp() {
    if (this.isDragging) {
      this.isDragging = false;
      this.dragTargetNode = null;
    }
  }

  createEdge(from, to, branch = 'default') {
    // Prevent duplicate edges
    const exists = this.workflow.edges.some(e => e.from === from && e.to === to && e.branch === branch);
    if (exists) {
      this.showToast('Connection already exists', true);
      return;
    }

    // For condition nodes or single out nodes, replace existing edge from same branch port
    this.workflow.edges = this.workflow.edges.filter(e => !(e.from === from && e.branch === branch));

    const id = 'edge_' + Math.random().toString(36).substring(2, 9);
    this.workflow.edges.push({ id, from, to, branch });
    this.showToast(`Connected ${from} -> ${to}`);
  }

  render() {
    this.renderNodes();
    this.renderConnections();
    this.renderInspector();
  }

  renderNodes() {
    this.nodesContainer.innerHTML = '';
    for (const node of this.workflow.nodes) {
      const el = document.createElement('div');
      el.className = `wf-node ${node.type} ${this.selectedNodeId === node.id ? 'selected' : ''}`;
      if (this.simulator && this.simulator.currentNodeId === node.id && !this.simulator.isDone) {
        el.classList.add('executing');
      }
      el.setAttribute('data-id', node.id);
      el.style.left = `${node.x}px`;
      el.style.top = `${node.y}px`;

      // Input port (except start)
      let portsHtml = '';
      if (node.type !== NODE_TYPES.START) {
        portsHtml += `<button type="button" class="wf-port in" data-node-id="${node.id}" data-port-type="in" title="Input Port" aria-label="Input connection"></button>`;
      }

      // Output ports
      if (node.type === NODE_TYPES.CONDITION) {
        portsHtml += `<button type="button" class="wf-port out out-true" data-node-id="${node.id}" data-port-type="out-true" title="True Branch" aria-label="True branch connection"></button>`;
        portsHtml += `<button type="button" class="wf-port out out-false" data-node-id="${node.id}" data-port-type="out-false" title="False Branch" aria-label="False branch connection"></button>`;
      } else if (node.type !== NODE_TYPES.END) {
        portsHtml += `<button type="button" class="wf-port out" data-node-id="${node.id}" data-port-type="out" title="Output Port" aria-label="Output connection"></button>`;
      }

      let icon = '⚡';
      if (node.type === NODE_TYPES.START) icon = '▶';
      else if (node.type === NODE_TYPES.CONDITION) icon = '◆';
      else if (node.type === NODE_TYPES.END) icon = '🏁';

      el.innerHTML = `
        ${portsHtml}
        <div class="wf-node-header ${node.type}">
          <span>${icon}</span>
          <span>${this.escapeHtml(node.label || node.type)}</span>
        </div>
        <div class="wf-node-content">
          <div>${this.escapeHtml(node.description || this.getNodeSummary(node))}</div>
          <small>${node.type.toUpperCase()} • ID: ${node.id.substring(0, 10)}</small>
        </div>
      `;

      this.nodesContainer.appendChild(el);
    }
  }

  getNodeSummary(node) {
    if (node.type === NODE_TYPES.CONDITION && node.config) {
      return `If ${node.config.field || 'field'} ${node.config.operator || 'equals'} "${node.config.value || ''}"`;
    }
    if (node.type === NODE_TYPES.ACTION && node.config) {
      return `${node.config.actionType || 'Action'}: ${node.config.paramKey || ''}`;
    }
    if (node.type === NODE_TYPES.START) return 'Triggers workflow execution';
    if (node.type === NODE_TYPES.END) return 'Terminal completion';
    return '';
  }

  renderConnections() {
    // Clear existing paths while preserving defs
    const defs = this.svgLayer.querySelector('defs');
    this.svgLayer.innerHTML = '';
    if (defs) this.svgLayer.appendChild(defs);

    const nodeEls = new Map();
    this.nodesContainer.querySelectorAll('.wf-node').forEach(el => {
      nodeEls.set(el.getAttribute('data-id'), el);
    });

    for (const edge of this.workflow.edges) {
      const fromEl = nodeEls.get(edge.from);
      const toEl = nodeEls.get(edge.to);
      if (!fromEl || !toEl) continue;

      const fromNode = this.workflow.nodes.find(n => n.id === edge.from);
      let fromPortX = fromNode.x + 210;
      let fromPortY = fromNode.y + 40;

      if (fromNode.type === NODE_TYPES.CONDITION) {
        if (edge.branch === 'true') {
          fromPortY = fromNode.y + 36;
        } else if (edge.branch === 'false') {
          fromPortY = fromNode.y + 70;
        }
      }

      const toNode = this.workflow.nodes.find(n => n.id === edge.to);
      const toPortX = toNode.x;
      const toPortY = toNode.y + 40;

      // Draw smooth cubic bezier curve
      const dx = Math.abs(toPortX - fromPortX) * 0.55;
      const pathData = `M ${fromPortX} ${fromPortY} C ${fromPortX + dx} ${fromPortY}, ${toPortX - dx} ${toPortY}, ${toPortX} ${toPortY}`;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pathData);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', edge.branch === 'true' ? '#10b981' : (edge.branch === 'false' ? '#ef4444' : '#6366f1'));
      path.setAttribute('stroke-width', '2.5');
      path.setAttribute('marker-end', 'url(#arrow)');
      path.style.cursor = 'pointer';
      path.style.pointerEvents = 'stroke';
      path.setAttribute('data-edge-id', edge.id);

      // Click to delete connection
      path.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Remove connection between "${fromNode.label}" and "${toNode.label}"?`)) {
          this.deleteEdge(edge.id);
        }
      });

      this.svgLayer.appendChild(path);

      // Label on condition branches
      if (edge.branch === 'true' || edge.branch === 'false') {
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', fromPortX + 16);
        text.setAttribute('y', fromPortY + (edge.branch === 'true' ? -6 : 14));
        text.setAttribute('fill', edge.branch === 'true' ? '#059669' : '#dc2626');
        text.setAttribute('font-size', '11');
        text.setAttribute('font-weight', 'bold');
        text.textContent = edge.branch.toUpperCase();
        this.svgLayer.appendChild(text);
      }
    }
  }

  renderInspector() {
    if (!this.selectedNodeId) {
      this.nodeInspector.innerHTML = `
        <div style="color:var(--muted); text-align:center; padding:32px 10px;">
          <p><strong>No Step Selected</strong></p>
          <small>Click any node on the canvas to configure its properties, rules, and parameters.</small>
        </div>
      `;
      return;
    }

    const node = this.workflow.nodes.find(n => n.id === this.selectedNodeId);
    if (!node) return;

    let specificControls = '';

    if (node.type === NODE_TYPES.ACTION) {
      const cfg = node.config || {};
      specificControls = `
        <div class="field">
          <label for="actionTypeSelect">Action Operation</label>
          <select id="actionTypeSelect">
            <option value="${ACTION_OPERATIONS.SET_VARIABLE}" ${cfg.actionType === ACTION_OPERATIONS.SET_VARIABLE ? 'selected' : ''}>Set / Update Variable</option>
            <option value="${ACTION_OPERATIONS.CALCULATE_SCORE}" ${cfg.actionType === ACTION_OPERATIONS.CALCULATE_SCORE ? 'selected' : ''}>Calculate / Increment Score</option>
            <option value="${ACTION_OPERATIONS.TRANSFORM_TEXT}" ${cfg.actionType === ACTION_OPERATIONS.TRANSFORM_TEXT ? 'selected' : ''}>Transform Text (Case / Trim)</option>
            <option value="${ACTION_OPERATIONS.SANITIZE_DATA}" ${cfg.actionType === ACTION_OPERATIONS.SANITIZE_DATA ? 'selected' : ''}>Sanitize Data Field</option>
            <option value="${ACTION_OPERATIONS.NOTIFY_LOG}" ${cfg.actionType === ACTION_OPERATIONS.NOTIFY_LOG ? 'selected' : ''}>Send Notification / Log</option>
          </select>
        </div>
        <div class="field">
          <label for="actionParamKey">Target Variable Name</label>
          <input id="actionParamKey" value="${this.escapeHtml(cfg.paramKey || 'status')}">
        </div>
        <div class="field">
          <label for="actionParamVal">Value / Argument</label>
          <input id="actionParamVal" value="${this.escapeHtml(String(cfg.paramValue !== undefined ? cfg.paramValue : 'processed'))}">
        </div>
      `;
    } else if (node.type === NODE_TYPES.CONDITION) {
      const cfg = node.config || {};
      specificControls = `
        <div class="field">
          <label for="condField">Evaluation Field</label>
          <input id="condField" value="${this.escapeHtml(cfg.field || 'customerTier')}">
        </div>
        <div class="field">
          <label for="condOperator">Condition Operator</label>
          <select id="condOperator">
            <option value="${CONDITION_OPERATORS.EQUALS}" ${cfg.operator === CONDITION_OPERATORS.EQUALS ? 'selected' : ''}>Equals (==)</option>
            <option value="${CONDITION_OPERATORS.NOT_EQUALS}" ${cfg.operator === CONDITION_OPERATORS.NOT_EQUALS ? 'selected' : ''}>Not Equals (!=)</option>
            <option value="${CONDITION_OPERATORS.GREATER_THAN}" ${cfg.operator === CONDITION_OPERATORS.GREATER_THAN ? 'selected' : ''}>Greater Than (&gt;)</option>
            <option value="${CONDITION_OPERATORS.LESS_THAN}" ${cfg.operator === CONDITION_OPERATORS.LESS_THAN ? 'selected' : ''}>Less Than (&lt;)</option>
            <option value="${CONDITION_OPERATORS.CONTAINS}" ${cfg.operator === CONDITION_OPERATORS.CONTAINS ? 'selected' : ''}>Contains Substring</option>
            <option value="${CONDITION_OPERATORS.IS_EMPTY}" ${cfg.operator === CONDITION_OPERATORS.IS_EMPTY ? 'selected' : ''}>Is Empty</option>
          </select>
        </div>
        <div class="field">
          <label for="condValue">Target Comparison Value</label>
          <input id="condValue" value="${this.escapeHtml(String(cfg.value !== undefined ? cfg.value : 'enterprise'))}">
        </div>
      `;
    }

    this.nodeInspector.innerHTML = `
      <div class="field">
        <label for="nodeLabelInput">Step Title</label>
        <input id="nodeLabelInput" value="${this.escapeHtml(node.label || '')}">
      </div>
      <div class="field">
        <label for="nodeDescInput">Description / Note</label>
        <textarea id="nodeDescInput" rows="2">${this.escapeHtml(node.description || '')}</textarea>
      </div>
      ${specificControls}
      <div class="actions" style="margin-top:20px;">
        <button id="btnDeleteSelected" type="button" class="btn danger small" style="width:100%;">Delete This Step</button>
      </div>
    `;

    // Bind inspector inputs
    document.getElementById('nodeLabelInput')?.addEventListener('input', (e) => {
      node.label = e.target.value;
      this.renderNodes();
    });
    document.getElementById('nodeDescInput')?.addEventListener('input', (e) => {
      node.description = e.target.value;
      this.renderNodes();
    });

    if (node.type === NODE_TYPES.ACTION) {
      document.getElementById('actionTypeSelect')?.addEventListener('change', (e) => {
        node.config = node.config || {};
        node.config.actionType = e.target.value;
        this.renderNodes();
      });
      document.getElementById('actionParamKey')?.addEventListener('input', (e) => {
        node.config = node.config || {};
        node.config.paramKey = e.target.value;
      });
      document.getElementById('actionParamVal')?.addEventListener('input', (e) => {
        node.config = node.config || {};
        node.config.paramValue = e.target.value;
      });
    }

    if (node.type === NODE_TYPES.CONDITION) {
      document.getElementById('condField')?.addEventListener('input', (e) => {
        node.config = node.config || {};
        node.config.field = e.target.value;
        this.renderNodes();
      });
      document.getElementById('condOperator')?.addEventListener('change', (e) => {
        node.config = node.config || {};
        node.config.operator = e.target.value;
        this.renderNodes();
      });
      document.getElementById('condValue')?.addEventListener('input', (e) => {
        node.config = node.config || {};
        node.config.value = e.target.value;
        this.renderNodes();
      });
    }

    document.getElementById('btnDeleteSelected')?.addEventListener('click', () => {
      this.deleteNode(node.id);
    });
  }

  validate(showToastFeedback = false) {
    const res = validateWorkflow(this.workflow);
    if (res.valid) {
      this.validationAlerts.innerHTML = `
        <div style="background:#ecfdf5; border:1px solid #a7f3d0; border-radius:10px; padding:10px 14px; color:#065f46; font-size:12px;">
          <strong>✓ Valid Workflow Structure</strong>
          ${res.warnings.length ? `<div style="margin-top:6px; color:#92400e;">${res.warnings.map(w => `• ${this.escapeHtml(w)}`).join('<br>')}</div>` : ''}
        </div>
      `;
      if (showToastFeedback) this.showToast('Workflow passed structural validation!');
    } else {
      this.validationAlerts.innerHTML = `
        <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:10px; padding:10px 14px; color:#991b1b; font-size:12px;">
          <strong>⚠ Validation Issues Found:</strong>
          <ul style="margin:6px 0 0 16px; padding:0;">
            ${res.errors.map(err => `<li>${this.escapeHtml(err)}</li>`).join('')}
          </ul>
        </div>
      `;
      if (showToastFeedback) this.showToast('Validation failed. Review errors in the inspector.', true);
    }
    return res.valid;
  }

  getSimulationPayload() {
    const payloadInput = document.getElementById('simPayloadInput');
    if (!payloadInput) return {};
    try {
      return JSON.parse(payloadInput.value || '{}');
    } catch (e) {
      this.showToast('Invalid initial payload JSON. Using empty context.', true);
      return {};
    }
  }

  startSimulation() {
    if (!this.validate(true)) return;
    const initialPayload = this.getSimulationPayload();
    this.simulator = new WorkflowSimulator(this.workflow, initialPayload);
    this.renderNodes();
    this.updateSimulationUI();
    this.showToast('Simulation initiated at Start node.');
  }

  stepSimulation() {
    if (!this.simulator) {
      this.startSimulation();
      return;
    }
    this.simulator.step();
    this.renderNodes();
    this.updateSimulationUI();
  }

  runAllSimulation() {
    if (!this.simulator) {
      this.startSimulation();
    }
    if (this.simulator) {
      this.simulator.runAll();
      this.renderNodes();
      this.updateSimulationUI();
      this.showToast('Simulation ran to completion.');
    }
  }

  resetSimulation() {
    this.simulator = null;
    this.renderNodes();
    this.simLogContainer.innerHTML = '<div style="color:var(--muted); font-size:12px;">Simulation reset. Click "Start Simulation" to execute.</div>';
    this.simContextContainer.textContent = JSON.stringify(this.getSimulationPayload(), null, 2);
  }

  updateSimulationUI() {
    if (!this.simulator) return;

    // Render step logs
    this.simLogContainer.innerHTML = this.simulator.logs.map(log => `
      <div style="padding:7px 0; border-bottom:1px solid #f1f1f5; font-size:12px;">
        <span style="font-weight:750; color:var(--brand);">[Step ${log.step}]</span>
        <strong>${this.escapeHtml(log.nodeLabel || log.type.toUpperCase())}:</strong>
        <span style="color:var(--ink);">${this.escapeHtml(log.message)}</span>
      </div>
    `).join('');
    this.simLogContainer.scrollTop = this.simLogContainer.scrollHeight;

    // Render variables
    this.simContextContainer.textContent = JSON.stringify(this.simulator.context, null, 2);
  }

  exportJson() {
    const jsonStr = JSON.stringify(this.workflow, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `intellitools-workflow-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('Workflow JSON exported');
  }

  promptImportJson() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 500000) {
        alert('File size exceeds maximum allowed 500 KB limit.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const parsed = parseWorkflowJson(evt.target.result);
          this.workflow = parsed;
          this.selectedNodeId = null;
          this.resetSimulation();
          this.render();
          this.validate(true);
          this.showToast('Workflow successfully imported!');
        } catch (err) {
          alert('Import Failed: ' + err.message);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  resetCanvas() {
    if (confirm('Are you sure you want to clear the canvas? All unsaved nodes will be removed.')) {
      this.workflow = {
        id: 'wf_' + Date.now(),
        name: 'Untitled Workflow',
        description: 'New workflow',
        nodes: [
          { id: 'node_start', type: NODE_TYPES.START, label: 'Start Trigger', x: 100, y: 150 },
          { id: 'node_end', type: NODE_TYPES.END, label: 'Complete', x: 500, y: 150 }
        ],
        edges: [
          { id: 'edge_init', from: 'node_start', to: 'node_end', branch: 'default' }
        ]
      };
      this.selectedNodeId = null;
      this.resetSimulation();
      this.render();
      this.validate();
      this.showToast('Canvas reset to blank template');
    }
  }

  escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  showToast(msg, isError = false) {
    let toast = document.getElementById('wfToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'wfToast';
      toast.style.cssText = 'position:fixed; bottom:24px; right:24px; z-index:100; padding:12px 20px; border-radius:12px; color:#fff; font-weight:700; font-size:13px; box-shadow:0 10px 30px rgba(0,0,0,.2); transition:opacity .3s;';
      document.body.appendChild(toast);
    }
    toast.style.background = isError ? '#ef4444' : '#10b981';
    toast.textContent = msg;
    toast.style.opacity = '1';
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { toast.style.opacity = '0'; }, 2400);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.workflowApp = new WorkflowApp();
});
