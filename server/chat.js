import { nanoid } from 'nanoid';
import { addMessage, getConversation, getSetting } from './db.js';
import { extractMentions, getAgents, runAgentTurn } from './swarm.js';

function nowTag() {
  return new Date().toLocaleString('zh-CN', { hour12: false });
}

function getKnownAgentIds() {
  return getAgents().map((a) => a.id);
}

function sanitizeContent(text) {
  return String(text || '').trim();
}

function buildAgentPrompt({ targetId, sourceType, sourceId, content, knownAgentIds }) {
  const mentionGuide = knownAgentIds.map((id) => `@${id}`).join(', ');
  const authorityLine = sourceId === 'main'
    ? 'Main agent instruction: high priority execution required unless unsafe.'
    : 'Peer message: you can collaborate by mentioning another agent.';

  return [
    `Time: ${nowTag()}`,
    `You are agent @${targetId} in a 5-agent swarm.`,
    `Known agents: ${mentionGuide}`,
    authorityLine,
    `Message source: ${sourceType}:${sourceId}`,
    '',
    'Incoming message:',
    content,
    '',
    'Rules:',
    '1) Keep response concise and actionable.',
    '2) If you need another agent, mention them as @agent-id in plain text.',
    '3) If you are giving final answer for current subtask, state it clearly.'
  ].join('\n');
}

async function relayFromAgent({
  conversationId,
  senderId,
  content,
  depth,
  maxDepth,
  maxDispatch,
  dispatchCounter
}) {
  if (depth > maxDepth) {
    return;
  }

  const knownAgentIds = getKnownAgentIds();
  const mentions = extractMentions(content, knownAgentIds).filter((id) => id !== senderId);
  if (mentions.length === 0) {
    return;
  }

  for (const targetId of mentions) {
    if (dispatchCounter.count >= maxDispatch) {
      addMessage({
        id: nanoid(),
        conversationId,
        senderType: 'system',
        senderId: 'router',
        content: `Dispatch limit reached (${maxDispatch}), stop relaying.`,
        mentions: []
      });
      return;
    }

    dispatchCounter.count += 1;
    addMessage({
      id: nanoid(),
      conversationId,
      senderType: 'system',
      senderId: 'router',
      content: `Relay: @${senderId} -> @${targetId}`,
      mentions: [targetId]
    });

    const prompt = buildAgentPrompt({
      targetId,
      sourceType: 'agent',
      sourceId: senderId,
      content,
      knownAgentIds
    });

    const result = await runAgentTurn(targetId, prompt);
    const responseText = (result.output || '').trim();

    addMessage({
      id: nanoid(),
      conversationId,
      senderType: 'agent',
      senderId: targetId,
      content: responseText || '(empty response)',
      mentions: extractMentions(responseText, knownAgentIds),
      status: result.ok ? 'ok' : 'error'
    });

    if (result.ok && responseText) {
      await relayFromAgent({
        conversationId,
        senderId: targetId,
        content: responseText,
        depth: depth + 1,
        maxDepth,
        maxDispatch,
        dispatchCounter
      });
    }
  }
}

async function handleUserMessage({ conversationId, content }) {
  const conv = getConversation(conversationId);
  if (!conv) {
    throw new Error('conversation not found');
  }

  const knownAgentIds = getKnownAgentIds();
  const message = sanitizeContent(content);
  if (!message) {
    throw new Error('message is empty');
  }

  const mentions = extractMentions(message, knownAgentIds);
  const initialTargets = mentions.length > 0 ? mentions : ['main'];

  addMessage({
    id: nanoid(),
    conversationId,
    senderType: 'user',
    senderId: 'user',
    content: message,
    mentions: initialTargets
  });

  const maxDepth = Math.max(0, Number(getSetting('relay.maxDepth', '2')) || 2);
  const maxDispatch = Math.max(1, Number(getSetting('relay.maxDispatch', '10')) || 10);
  const dispatchCounter = { count: 0 };

  for (const targetId of initialTargets) {
    if (dispatchCounter.count >= maxDispatch) {
      break;
    }

    dispatchCounter.count += 1;
    addMessage({
      id: nanoid(),
      conversationId,
      senderType: 'system',
      senderId: 'router',
      content: `Dispatch: user -> @${targetId}`,
      mentions: [targetId]
    });

    const prompt = buildAgentPrompt({
      targetId,
      sourceType: 'user',
      sourceId: 'user',
      content: message,
      knownAgentIds
    });

    const result = await runAgentTurn(targetId, prompt);
    const responseText = (result.output || '').trim();
    const responseMentions = extractMentions(responseText, knownAgentIds);

    addMessage({
      id: nanoid(),
      conversationId,
      senderType: 'agent',
      senderId: targetId,
      content: responseText || '(empty response)',
      mentions: responseMentions,
      status: result.ok ? 'ok' : 'error'
    });

    if (result.ok && responseText) {
      await relayFromAgent({
        conversationId,
        senderId: targetId,
        content: responseText,
        depth: 1,
        maxDepth,
        maxDispatch,
        dispatchCounter
      });
    }
  }
}

export { handleUserMessage };
