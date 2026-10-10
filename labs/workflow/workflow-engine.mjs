/**
 * IntelliTools V5 — Visual Workflow Lab Core Engine
 * Headless, deterministic workflow validation, simulation, and serialization.
 * Free of DOM dependencies to allow comprehensive automated testing.
 */

export const NODE_TYPES = {
  START: 'start',
  ACTION: 'action',
  CONDITION: 'condition',
  END: 'end'
};

export const ACTION_OPERATIONS = {
  SET_VARIABLE: 'set_variable',
  TRANSFORM_TEXT: 'transform_text',
  NOTIFY_LOG: 'notify_log',
  CALCULATE_SCORE: 'calculate_score',
  SANITIZE_DATA: 'sanitize_data'
};

export const CONDITION_OPERATORS = {
  EQUALS: 'equals',
  NOT_EQUALS: 'not_equals',
  GREATER_THAN: 'greater_than',
  LESS_THAN: 'less_than',
  CONTAINS: 'contains',
  IS_EMPTY: 'is_empty'
};

/**
 * Validates workflow graph structure and connectivity
 */
export function validateWorkflow(workflow) {
  const errors = [];
  const warnings = [];

  if (!workflow || typeof workflow !== 'object') {
    return { valid: false, errors: ['Invalid workflow payload: must be an object'], warnings: [] };
  }

  const nodes = Array.isArray(workflow.nodes) ? workflow.nodes : [];
  const edges = Array.isArray(workflow.edges) ? workflow.edges : [];

  if (nodes.length === 0) {
    return { valid: false, errors: ['Workflow is empty. Add at least a Start, an Action, and an End node.'], warnings: [] };
  }

  const nodeMap = new Map();
  for (const node of nodes) {
    if (!node.id || !node.type) {
      errors.push(`Node missing required id or type property: ${JSON.stringify(node)}`);
    } else {
      if (nodeMap.has(node.id)) {
        errors.push(`Duplicate node id found: ${node.id}`);
      }
      nodeMap.set(node.id, node);
    }
  }

  const startNodes = nodes.filter(n => n.type === NODE_TYPES.START);
  const endNodes = nodes.filter(n => n.type === NODE_TYPES.END);

  if (startNodes.length === 0) {
    errors.push('Workflow missing a Start node. Workflows must have exactly one starting trigger.');
  } else if (startNodes.length > 1) {
    errors.push(`Workflow has ${startNodes.length} Start nodes. Only one Start trigger is supported per workflow.`);
  }

  if (endNodes.length === 0) {
    errors.push('Workflow missing an End node. Workflows must have at least one terminal outcome.');
  }

  // Check edges
  const incoming = new Map();
  const outgoing = new Map();
  for (const n of nodes) {
    incoming.set(n.id, []);
    outgoing.set(n.id, []);
  }

  for (const edge of edges) {
    if (!edge.from || !edge.to) {
      errors.push(`Edge missing from or to node reference: ${JSON.stringify(edge)}`);
      continue;
    }
    if (!nodeMap.has(edge.from)) {
      errors.push(`Edge references non-existent source node: ${edge.from}`);
      continue;
    }
    if (!nodeMap.has(edge.to)) {
      errors.push(`Edge references non-existent target node: ${edge.to}`);
      continue;
    }

    outgoing.get(edge.from).push(edge);
    incoming.get(edge.to).push(edge);
  }

  // Node-specific connectivity rules
  for (const node of nodes) {
    const outs = outgoing.get(node.id) || [];
    const ins = incoming.get(node.id) || [];

    if (node.type === NODE_TYPES.START) {
      if (ins.length > 0) {
        warnings.push(`Start node "${node.label || node.id}" has incoming connections; triggers should not have inputs.`);
      }
      if (outs.length === 0) {
        errors.push(`Start node "${node.label || node.id}" has no outgoing connection.`);
      }
    } else if (node.type === NODE_TYPES.END) {
      if (ins.length === 0) {
        errors.push(`End node "${node.label || node.id}" has no incoming connection.`);
      }
      if (outs.length > 0) {
        warnings.push(`End node "${node.label || node.id}" has outgoing connections; terminal steps should not branch.`);
      }
    } else if (node.type === NODE_TYPES.CONDITION) {
      if (ins.length === 0) {
        errors.push(`Condition node "${node.label || node.id}" has no incoming connection.`);
      }
      const trueBranch = outs.find(e => e.branch === 'true');
      const falseBranch = outs.find(e => e.branch === 'false');
      if (!trueBranch) {
        errors.push(`Condition node "${node.label || node.id}" is missing a "True" branch connection.`);
      }
      if (!falseBranch) {
        errors.push(`Condition node "${node.label || node.id}" is missing a "False" branch connection.`);
      }
    } else if (node.type === NODE_TYPES.ACTION) {
      if (ins.length === 0) {
        errors.push(`Action node "${node.label || node.id}" is disconnected (no incoming connection).`);
      }
      if (outs.length === 0) {
        errors.push(`Action node "${node.label || node.id}" has no outgoing connection.`);
      }
    }
  }

  // Reachability check from Start node
  if (startNodes.length === 1 && errors.length === 0) {
    const reachable = new Set();
    const queue = [startNodes[0].id];
    while (queue.length > 0) {
      const curr = queue.shift();
      if (!reachable.has(curr)) {
        reachable.add(curr);
        const nextEdges = outgoing.get(curr) || [];
        for (const edge of nextEdges) {
          queue.push(edge.to);
        }
      }
    }

    for (const node of nodes) {
      if (!reachable.has(node.id)) {
        warnings.push(`Node "${node.label || node.id}" is unreachable from the Start node.`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Safely evaluates a condition rule against context variables
 * Strictly deterministic — no eval() or new Function().
 */
export function evaluateCondition(config, context) {
  if (!config) return false;
  const field = String(config.field || '').trim();
  const operator = config.operator || CONDITION_OPERATORS.EQUALS;
  const targetVal = config.value !== undefined ? String(config.value) : '';

  const actualRaw = context[field];
  const actualStr = actualRaw !== undefined && actualRaw !== null ? String(actualRaw) : '';
  const actualNum = Number(actualRaw);
  const targetNum = Number(targetVal);

  switch (operator) {
    case CONDITION_OPERATORS.EQUALS:
      return actualStr.toLowerCase() === targetVal.toLowerCase();
    case CONDITION_OPERATORS.NOT_EQUALS:
      return actualStr.toLowerCase() !== targetVal.toLowerCase();
    case CONDITION_OPERATORS.GREATER_THAN:
      return !isNaN(actualNum) && !isNaN(targetNum) ? actualNum > targetNum : actualStr > targetVal;
    case CONDITION_OPERATORS.LESS_THAN:
      return !isNaN(actualNum) && !isNaN(targetNum) ? actualNum < targetNum : actualStr < targetVal;
    case CONDITION_OPERATORS.CONTAINS:
      return actualStr.toLowerCase().includes(targetVal.toLowerCase());
    case CONDITION_OPERATORS.IS_EMPTY:
      return actualStr.length === 0;
    default:
      return false;
  }
}

/**
 * Executes a single action step deterministically
 */
export function executeAction(node, context) {
  const newContext = { ...context };
  const config = node.config || {};
  const op = config.actionType || ACTION_OPERATIONS.NOTIFY_LOG;
  let logDetail = '';

  switch (op) {
    case ACTION_OPERATIONS.SET_VARIABLE: {
      const key = String(config.paramKey || 'var').trim();
      const val = config.paramValue !== undefined ? config.paramValue : '';
      newContext[key] = val;
      logDetail = `Set variable "${key}" = ${JSON.stringify(val)}`;
      break;
    }
    case ACTION_OPERATIONS.TRANSFORM_TEXT: {
      const srcKey = config.paramKey || 'text';
      const destKey = config.destKey || srcKey;
      const mode = config.transformMode || 'uppercase';
      const text = String(newContext[srcKey] || '');
      if (mode === 'uppercase') newContext[destKey] = text.toUpperCase();
      else if (mode === 'lowercase') newContext[destKey] = text.toLowerCase();
      else if (mode === 'trim') newContext[destKey] = text.trim();
      logDetail = `Transformed "${srcKey}" (${mode}) -> "${destKey}"`;
      break;
    }
    case ACTION_OPERATIONS.CALCULATE_SCORE: {
      const scoreKey = config.paramKey || 'score';
      const delta = Number(config.paramValue) || 10;
      const current = Number(newContext[scoreKey]) || 0;
      newContext[scoreKey] = current + delta;
      logDetail = `Updated "${scoreKey}": ${current} + ${delta} = ${newContext[scoreKey]}`;
      break;
    }
    case ACTION_OPERATIONS.SANITIZE_DATA: {
      const target = config.paramKey || 'email';
      const raw = String(newContext[target] || '');
      const cleanTags = raw.replace(/<[^>]*>/g, '').trim();
      const emailMatch = cleanTags.match(/[\w.+%-]+@[\w.-]+\.[A-Za-z]{2,}/);
      newContext[target] = emailMatch ? emailMatch[0] : cleanTags.replace(/[^\w.@+-]/g, '').trim();
      logDetail = `Sanitized input for "${target}"`;
      break;
    }
    case ACTION_OPERATIONS.NOTIFY_LOG:
    default: {
      const msg = config.paramValue || `Action ${node.label} triggered`;
      logDetail = `Message: "${msg}"`;
      break;
    }
  }

  return { newContext, logDetail };
}

/**
 * Simulates workflow execution step by step
 */
export class WorkflowSimulator {
  constructor(workflow, initialPayload = {}) {
    this.workflow = workflow;
    this.context = { ...initialPayload };
    this.currentNodeId = null;
    this.stepIndex = 0;
    this.isDone = false;
    this.logs = [];
    this.visitedNodes = new Set();
    this.maxSteps = 100; // Cycle guard

    const startNode = (workflow.nodes || []).find(n => n.type === NODE_TYPES.START);
    if (startNode) {
      this.currentNodeId = startNode.id;
    } else {
      this.isDone = true;
      this.logs.push({ step: 0, type: 'error', message: 'No start node available in workflow.' });
    }
  }

  step() {
    if (this.isDone) {
      return { done: true, logs: this.logs, context: this.context };
    }

    if (this.stepIndex >= this.maxSteps) {
      this.isDone = true;
      this.logs.push({
        step: this.stepIndex,
        type: 'error',
        message: `Execution halted: exceeded maximum step threshold (${this.maxSteps}) to prevent infinite loops.`
      });
      return { done: true, logs: this.logs, context: this.context };
    }

    const node = (this.workflow.nodes || []).find(n => n.id === this.currentNodeId);
    if (!node) {
      this.isDone = true;
      this.logs.push({ step: this.stepIndex, type: 'error', message: `Execution failed: Node ${this.currentNodeId} not found.` });
      return { done: true, logs: this.logs, context: this.context };
    }

    this.stepIndex++;
    this.visitedNodes.add(node.id);

    const edges = (this.workflow.edges || []).filter(e => e.from === node.id);

    if (node.type === NODE_TYPES.START) {
      this.logs.push({
        step: this.stepIndex,
        nodeId: node.id,
        nodeLabel: node.label || 'Start',
        type: 'start',
        message: `Workflow started. Initial payload loaded with ${Object.keys(this.context).length} fields.`
      });
      if (edges.length > 0) {
        this.currentNodeId = edges[0].to;
      } else {
        this.isDone = true;
      }
    } else if (node.type === NODE_TYPES.ACTION) {
      const { newContext, logDetail } = executeAction(node, this.context);
      this.context = newContext;
      this.logs.push({
        step: this.stepIndex,
        nodeId: node.id,
        nodeLabel: node.label || 'Action',
        type: 'action',
        message: `Executed action: ${logDetail}`
      });
      if (edges.length > 0) {
        this.currentNodeId = edges[0].to;
      } else {
        this.isDone = true;
      }
    } else if (node.type === NODE_TYPES.CONDITION) {
      const result = evaluateCondition(node.config, this.context);
      const branchTaken = result ? 'true' : 'false';
      this.logs.push({
        step: this.stepIndex,
        nodeId: node.id,
        nodeLabel: node.label || 'Condition',
        type: 'condition',
        message: `Evaluated [${node.config?.field || 'field'} ${node.config?.operator || 'equals'} "${node.config?.value || ''}"] => ${result.toString().toUpperCase()}. Taking ${branchTaken} branch.`
      });
      const matchingEdge = edges.find(e => e.branch === branchTaken);
      if (matchingEdge) {
        this.currentNodeId = matchingEdge.to;
      } else {
        this.isDone = true;
        this.logs.push({
          step: this.stepIndex,
          type: 'warning',
          message: `No connection found for branch "${branchTaken}". Workflow terminated at Condition.`
        });
      }
    } else if (node.type === NODE_TYPES.END) {
      this.isDone = true;
      this.logs.push({
        step: this.stepIndex,
        nodeId: node.id,
        nodeLabel: node.label || 'End',
        type: 'end',
        message: `Workflow completed at terminal outcome "${node.label}". Final state reached.`
      });
    }

    return {
      done: this.isDone,
      currentNodeId: this.currentNodeId,
      stepIndex: this.stepIndex,
      context: { ...this.context },
      logs: [...this.logs]
    };
  }

  runAll() {
    while (!this.isDone && this.stepIndex < this.maxSteps) {
      this.step();
    }
    return {
      done: true,
      stepCount: this.stepIndex,
      context: this.context,
      logs: this.logs
    };
  }
}

/**
 * Validates and parses imported JSON files
 */
export function parseWorkflowJson(jsonStr) {
  if (typeof jsonStr !== 'string') {
    throw new Error('Input must be a valid JSON string.');
  }
  if (jsonStr.length > 500000) {
    throw new Error('Oversized input: Workflow JSON exceeds maximum allowed size of 500 KB.');
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (err) {
    throw new Error(`Malformed JSON syntax: ${err.message}`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Workflow JSON must be an object with "nodes" and "edges" arrays.');
  }

  if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
    throw new Error('Workflow JSON is missing required "nodes" or "edges" array.');
  }

  return parsed;
}

/**
 * Curated practical sample workflows
 */
export const SAMPLE_WORKFLOWS = {
  customerSupport: {
    id: 'wf_customer_support',
    name: 'Customer Support Ticket Triage',
    description: 'Automatically qualifies customer tickets based on priority and tier, routing VIP issues immediately.',
    initialPayload: {
      customerTier: 'enterprise',
      urgency: 'high',
      ticketSubject: 'Production API downtime',
      assignedTeam: 'unassigned',
      priorityScore: 0
    },
    nodes: [
      { id: 'node_start', type: NODE_TYPES.START, label: 'Ticket Ingestion', x: 80, y: 150 },
      { id: 'node_sanitize', type: NODE_TYPES.ACTION, label: 'Sanitize Metadata', config: { actionType: ACTION_OPERATIONS.TRANSFORM_TEXT, paramKey: 'customerTier', transformMode: 'lowercase' }, x: 300, y: 150 },
      { id: 'node_cond_vip', type: NODE_TYPES.CONDITION, label: 'Check Enterprise Tier', config: { field: 'customerTier', operator: CONDITION_OPERATORS.EQUALS, value: 'enterprise' }, x: 550, y: 150 },
      { id: 'node_vip_score', type: NODE_TYPES.ACTION, label: 'Boost Priority Score', config: { actionType: ACTION_OPERATIONS.CALCULATE_SCORE, paramKey: 'priorityScore', paramValue: 100 }, x: 800, y: 70 },
      { id: 'node_standard_score', type: NODE_TYPES.ACTION, label: 'Set Standard Priority', config: { actionType: ACTION_OPERATIONS.CALCULATE_SCORE, paramKey: 'priorityScore', paramValue: 20 }, x: 800, y: 240 },
      { id: 'node_vip_end', type: NODE_TYPES.END, label: 'Page On-Call Tier 3', x: 1050, y: 70 },
      { id: 'node_standard_end', type: NODE_TYPES.END, label: 'Queue in General Support', x: 1050, y: 240 }
    ],
    edges: [
      { id: 'e1', from: 'node_start', to: 'node_sanitize', branch: 'default' },
      { id: 'e2', from: 'node_sanitize', to: 'node_cond_vip', branch: 'default' },
      { id: 'e3', from: 'node_cond_vip', to: 'node_vip_score', branch: 'true' },
      { id: 'e4', from: 'node_cond_vip', to: 'node_standard_score', branch: 'false' },
      { id: 'e5', from: 'node_vip_score', to: 'node_vip_end', branch: 'default' },
      { id: 'e6', from: 'node_standard_score', to: 'node_standard_end', branch: 'default' }
    ]
  },

  leadQualification: {
    id: 'wf_lead_qualification',
    name: 'Inbound Lead Qualification & Routing',
    description: 'Calculates employee count thresholds to route inbound sales leads to enterprise vs SMB reps.',
    initialPayload: {
      companyName: 'Acme Corp',
      employeeCount: 250,
      leadStatus: 'new'
    },
    nodes: [
      { id: 'l_start', type: NODE_TYPES.START, label: 'New Demo Request', x: 80, y: 150 },
      { id: 'l_cond', type: NODE_TYPES.CONDITION, label: 'Employees >= 100?', config: { field: 'employeeCount', operator: CONDITION_OPERATORS.GREATER_THAN, value: '99' }, x: 340, y: 150 },
      { id: 'l_act_ent', type: NODE_TYPES.ACTION, label: 'Assign Enterprise Account Exec', config: { actionType: ACTION_OPERATIONS.SET_VARIABLE, paramKey: 'assignedRep', paramValue: 'Enterprise Sales Team' }, x: 620, y: 70 },
      { id: 'l_act_smb', type: NODE_TYPES.ACTION, label: 'Assign Commercial Rep', config: { actionType: ACTION_OPERATIONS.SET_VARIABLE, paramKey: 'assignedRep', paramValue: 'SMB Sales Team' }, x: 620, y: 240 },
      { id: 'l_end_ent', type: NODE_TYPES.END, label: 'Send Calendar Booking Link', x: 920, y: 70 },
      { id: 'l_end_smb', type: NODE_TYPES.END, label: 'Send Self-Serve Product Tour', x: 920, y: 240 }
    ],
    edges: [
      { id: 'le1', from: 'l_start', to: 'l_cond', branch: 'default' },
      { id: 'le2', from: 'l_cond', to: 'l_act_ent', branch: 'true' },
      { id: 'le3', from: 'l_cond', to: 'l_act_smb', branch: 'false' },
      { id: 'le4', from: 'l_act_ent', to: 'l_end_ent', branch: 'default' },
      { id: 'le5', from: 'l_act_smb', to: 'l_end_smb', branch: 'default' }
    ]
  },

  documentPrivacy: {
    id: 'wf_doc_privacy',
    name: 'Document Privacy & Redaction Pipeline',
    description: 'Inspects document sensitivity tags and triggers redaction before archiving.',
    initialPayload: {
      documentType: 'contract',
      containsSensitivePII: 'true',
      isRedacted: 'false'
    },
    nodes: [
      { id: 'p_start', type: NODE_TYPES.START, label: 'Document Uploaded', x: 80, y: 150 },
      { id: 'p_check', type: NODE_TYPES.CONDITION, label: 'Has Sensitive PII?', config: { field: 'containsSensitivePII', operator: CONDITION_OPERATORS.EQUALS, value: 'true' }, x: 330, y: 150 },
      { id: 'p_redact', type: NODE_TYPES.ACTION, label: 'Apply Redaction Filter', config: { actionType: ACTION_OPERATIONS.SET_VARIABLE, paramKey: 'isRedacted', paramValue: 'true' }, x: 600, y: 70 },
      { id: 'p_log', type: NODE_TYPES.ACTION, label: 'Log Clean Document', config: { actionType: ACTION_OPERATIONS.NOTIFY_LOG, paramValue: 'No redaction necessary' }, x: 600, y: 240 },
      { id: 'p_end', type: NODE_TYPES.END, label: 'Archive to Secure Vault', x: 880, y: 150 }
    ],
    edges: [
      { id: 'pe1', from: 'p_start', to: 'p_check', branch: 'default' },
      { id: 'pe2', from: 'p_check', to: 'p_redact', branch: 'true' },
      { id: 'pe3', from: 'p_check', to: 'p_log', branch: 'false' },
      { id: 'pe4', from: 'p_redact', to: 'p_end', branch: 'default' },
      { id: 'pe5', from: 'p_log', to: 'p_end', branch: 'default' }
    ]
  }
};
