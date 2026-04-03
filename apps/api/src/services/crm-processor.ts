/**
 * CRM Processor for PodcastIA
 * Integrates with CRM webhooks/APIs (FlwChat, HubSpot, Custom) to pull recent activities.
 */

export interface CRMConfig {
  provider: 'flw' | 'hubspot' | 'custom';
  apiUrl: string;
  apiToken: string;
  filters?: string;
}

export interface CRMItem {
  group_name: string;
  sender: string;
  content: string;
}

const USER_AGENT = 'PodcastIA-CRM/1.0';

/**
 * Fetch recent sessions from FlwChat CRM.
 * Uses /chat/v2/session endpoint with token header.
 */
async function fetchFlwSessions(config: CRMConfig): Promise<CRMItem[]> {
  const items: CRMItem[] = [];
  const baseUrl = config.apiUrl.replace(/\/+$/, '');
  const url = `${baseUrl}/chat/v2/session?PageSize=30&OrderDesc=true`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        'Authorization': `Bearer ${config.apiToken}`,
        'Accept': 'application/json',
      },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.error(`[crm-processor] FlwChat HTTP ${res.status}`);
      return [];
    }

    const data = await res.json();
    const sessions = data?.items || data?.Items || (Array.isArray(data) ? data : []);

    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    for (const session of sessions) {
      const createdAt = session.createdAt || session.CreatedAt || session.created_at;
      if (createdAt) {
        const sessionTime = new Date(createdAt).getTime();
        if (now - sessionTime > oneDayMs) continue;
      }

      const contactName = session.contactName || session.ContactName || session.contact?.name || 'Desconhecido';
      const agentName = session.agentName || session.AgentName || session.agent?.name || '';
      const dept = session.departmentName || session.DepartmentName || '';
      const status = session.status || session.Status || '';
      const msgCount = session.messageCount || session.MessageCount || 0;

      const parts: string[] = [];
      parts.push(`Contato: ${contactName}`);
      if (agentName) parts.push(`Agente: ${agentName}`);
      if (dept) parts.push(`Depto: ${dept}`);
      if (status) parts.push(`Status: ${status}`);
      if (msgCount) parts.push(`Msgs: ${msgCount}`);
      if (createdAt) parts.push(`Data: ${new Date(createdAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);

      items.push({
        group_name: 'CRM: FlwChat',
        sender: contactName,
        content: parts.join(' | '),
      });
    }

    return items.slice(0, 20);
  } catch (err: any) {
    clearTimeout(timeout);
    console.error(`[crm-processor] FlwChat error: ${err.message}`);
    return [];
  }
}

/**
 * Fetch recent deals/contacts from HubSpot CRM.
 */
async function fetchHubSpotActivity(config: CRMConfig): Promise<CRMItem[]> {
  const items: CRMItem[] = [];
  const baseUrl = config.apiUrl?.replace(/\/+$/, '') || 'https://api.hubapi.com';

  // Fetch recent deals
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const dealsUrl = `${baseUrl}/crm/v3/objects/deals?limit=20&sorts=-createdate&properties=dealname,amount,dealstage,closedate,pipeline`;
    const res = await fetch(dealsUrl, {
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${config.apiToken}`,
        'Accept': 'application/json',
      },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.error(`[crm-processor] HubSpot HTTP ${res.status}`);
      return [];
    }

    const data = await res.json();
    const deals = data?.results || [];

    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    for (const deal of deals) {
      const props = deal.properties || {};
      const createdAt = props.createdate || deal.createdAt;
      if (createdAt && (now - new Date(createdAt).getTime()) > oneDayMs) continue;

      const parts: string[] = [];
      if (props.dealname) parts.push(`Deal: ${props.dealname}`);
      if (props.amount) parts.push(`Valor: R$${Number(props.amount).toLocaleString('pt-BR')}`);
      if (props.dealstage) parts.push(`Etapa: ${props.dealstage}`);
      if (props.pipeline) parts.push(`Pipeline: ${props.pipeline}`);
      if (createdAt) parts.push(`Data: ${new Date(createdAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);

      items.push({
        group_name: 'CRM: HubSpot',
        sender: props.dealname || 'Deal',
        content: parts.join(' | '),
      });
    }

    return items.slice(0, 20);
  } catch (err: any) {
    clearTimeout(timeout);
    console.error(`[crm-processor] HubSpot error: ${err.message}`);
    return [];
  }
}

/**
 * Fetch data from a custom CRM endpoint.
 * Generic HTTP GET with auth header, parse JSON response.
 */
async function fetchCustomCRM(config: CRMConfig): Promise<CRMItem[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'User-Agent': USER_AGENT,
    };

    if (config.apiToken) {
      headers['Authorization'] = `Bearer ${config.apiToken}`;
    }

    const res = await fetch(config.apiUrl, {
      signal: controller.signal,
      headers,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.error(`[crm-processor] Custom CRM HTTP ${res.status}`);
      return [];
    }

    const data = await res.json();
    const records = Array.isArray(data) ? data : (data?.items || data?.results || data?.data || data?.records || []);

    if (!Array.isArray(records)) {
      return [{
        group_name: 'CRM: Custom',
        sender: 'API',
        content: typeof data === 'string' ? data : JSON.stringify(data, null, 2).slice(0, 5000),
      }];
    }

    return records.slice(0, 20).map((record: any) => {
      const name = record.name || record.contactName || record.dealname || record.title || record.id || 'Registro';
      const parts: string[] = [];
      for (const [key, val] of Object.entries(record)) {
        if (val && typeof val !== 'object' && String(val).length < 200) {
          parts.push(`${key}: ${val}`);
        }
        if (parts.length >= 6) break;
      }
      return {
        group_name: 'CRM: Custom',
        sender: String(name),
        content: parts.join(' | '),
      };
    });
  } catch (err: any) {
    clearTimeout(timeout);
    console.error(`[crm-processor] Custom CRM error: ${err.message}`);
    return [];
  }
}

/**
 * Main entry point - routes to the appropriate CRM provider.
 */
export async function fetchCRMContent(config: CRMConfig): Promise<CRMItem[]> {
  if (!config.apiUrl || !config.apiToken) {
    console.error('[crm-processor] Missing apiUrl or apiToken');
    return [];
  }

  console.log(`[crm-processor] Fetching from provider: ${config.provider}`);

  switch (config.provider) {
    case 'flw':
      return fetchFlwSessions(config);
    case 'hubspot':
      return fetchHubSpotActivity(config);
    case 'custom':
    default:
      return fetchCustomCRM(config);
  }
}
