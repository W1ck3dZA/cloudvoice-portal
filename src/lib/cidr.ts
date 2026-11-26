/**
 * Allowlist address checks, mirroring cloudvoice-backend's src/utils/cidr.js
 * so people see a problem while typing. The API still decides.
 */

export type CidrCheck =
  | { ok: true; cidr: string; version: 4 | 6; prefix: number; covers: string }
  | { ok: false; error: string };

const MIN_PREFIX = { 4: 24, 6: 48 } as const;
const BITS = { 4: 32, 6: 128 } as const;

const V4 =
  /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

function v4ToBig(ip: string): bigint {
  return ip.split('.').reduce((acc, o) => (acc << 8n) | BigInt(Number(o)), 0n);
}

function v6ToBig(ip: string): bigint | null {
  let s = ip.toLowerCase();
  const tail = s.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (tail) {
    if (!V4.test(tail[1])) return null;
    const n = v4ToBig(tail[1]);
    s =
      s.slice(0, -tail[1].length) +
      `${(n >> 16n).toString(16)}:${(n & 0xffffn).toString(16)}`;
  }
  if ((s.match(/::/g) || []).length > 1) return null;
  const [head, rest] = s.includes('::') ? s.split('::') : [s, null];
  const h = head ? head.split(':') : [];
  const t = rest ? rest.split(':') : [];
  if (rest === null && h.length !== 8) return null;
  if (rest !== null && h.length + t.length > 7) return null;
  const groups =
    rest === null
      ? h
      : [...h, ...Array(8 - h.length - t.length).fill('0'), ...t];
  if (!groups.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return null;
  return groups.reduce((acc, g) => (acc << 16n) | BigInt(parseInt(g, 16)), 0n);
}

function bigToV4(n: bigint) {
  return [24n, 16n, 8n, 0n].map((s) => ((n >> s) & 0xffn).toString()).join('.');
}

function bigToV6(n: bigint) {
  const g: number[] = [];
  for (let i = 7; i >= 0; i--) g.push(Number((n >> BigInt(i * 16)) & 0xffffn));
  let best = -1;
  let bestLen = 0;
  for (let i = 0; i < 8;) {
    if (g[i] !== 0) {
      i++;
      continue;
    }
    let j = i;
    while (j < 8 && g[j] === 0) j++;
    if (j - i > bestLen && j - i > 1) {
      best = i;
      bestLen = j - i;
    }
    i = j;
  }
  const hex = g.map((x) => x.toString(16));
  if (best < 0) return hex.join(':');
  return `${hex.slice(0, best).join(':')}::${hex.slice(best + bestLen).join(':')}`;
}

type Range = { version: 4 | 6; start: bigint; end: bigint };

function parse(input: string):
  | {
      ok: true;
      version: 4 | 6;
      prefix: number;
      start: bigint;
      end: bigint;
      network: string;
    }
  | { ok: false; error: string } {
  const [addr, pfx, extra] = input.trim().split('/');
  const generic =
    'Enter an IP address like 41.0.0.10, or a range like 41.0.0.0/24.';
  if (!addr || extra !== undefined) return { ok: false, error: generic };
  const version = V4.test(addr) ? 4 : addr.includes(':') ? 6 : 0;
  if (!version) return { ok: false, error: generic };
  const ip = version === 4 ? v4ToBig(addr) : v6ToBig(addr);
  if (ip === null) return { ok: false, error: generic };

  const bits = BITS[version];
  let prefix: number = bits;
  if (pfx !== undefined) {
    if (!/^\d{1,3}$/.test(pfx) || Number(pfx) > bits) {
      return {
        ok: false,
        error: `/${pfx} isn't a valid IPv${version} range size.`,
      };
    }
    prefix = Number(pfx);
  }
  const hostMask = (1n << BigInt(bits - prefix)) - 1n;
  const start = ip & ~hostMask & ((1n << BigInt(bits)) - 1n);
  const network = version === 4 ? bigToV4(start) : bigToV6(start);
  if (ip !== start) {
    return {
      ok: false,
      error: `${input.trim()} isn't the start of its range. Use ${network}/${prefix}.`,
    };
  }
  return { ok: true, version, prefix, start, end: start | hostMask, network };
}

// Ranges that never belong on a public allowlist, with the reason shown.
const BLOCKED: (Range & { why: string })[] = [
  ['0.0.0.0/8', 'is reserved'],
  ['10.0.0.0/8', 'is a private address'],
  ['100.64.0.0/10', 'is a carrier NAT address'],
  ['127.0.0.0/8', 'is a loopback address'],
  ['169.254.0.0/16', 'is a link-local address'],
  ['172.16.0.0/12', 'is a private address'],
  ['192.0.0.0/24', 'is reserved'],
  ['192.0.2.0/24', 'is reserved for documentation'],
  ['192.168.0.0/16', 'is a private address'],
  ['198.18.0.0/15', 'is reserved for testing'],
  ['198.51.100.0/24', 'is reserved for documentation'],
  ['203.0.113.0/24', 'is reserved for documentation'],
  ['224.0.0.0/4', 'is a multicast address'],
  ['240.0.0.0/4', 'is reserved'],
  ['::/128', 'is reserved'],
  ['::1/128', 'is a loopback address'],
  [
    '::ffff:0:0/96',
    'is an IPv4-mapped address; enter the IPv4 address instead',
  ],
  ['64:ff9b::/96', 'is a NAT64 address'],
  ['100::/64', 'is reserved'],
  ['2001:db8::/32', 'is reserved for documentation'],
  ['fc00::/7', 'is a private address'],
  ['fe80::/10', 'is a link-local address'],
  ['ff00::/8', 'is a multicast address'],
].map(([c, why]) => {
  const p = parse(c);
  if (!p.ok) throw new Error(`bad blocked range ${c}`);
  return { version: p.version, start: p.start, end: p.end, why };
});

/** Check an address the way the API does, and describe what it covers. */
export function checkAllowlistCidr(input: string): CidrCheck {
  const p = parse(input);
  if (!p.ok) return p;
  const min = MIN_PREFIX[p.version];
  if (p.prefix < min) {
    return {
      ok: false,
      error:
        p.version === 4
          ? `That range is too wide. The largest allowed is a /24 (256 addresses).`
          : `That range is too wide. The largest allowed is a /48.`,
    };
  }
  const shown = input.trim();
  const hit = BLOCKED.find(
    (b) => b.version === p.version && p.start <= b.end && p.end >= b.start,
  );
  if (hit) {
    const tail = hit.why.includes(';')
      ? '.'
      : '. Use the public IP your system sends from.';
    return { ok: false, error: `${shown} ${hit.why}${tail}` };
  }
  const single = p.prefix === BITS[p.version];
  const end = bigToV4(p.end);
  const covers = single
    ? 'Single address'
    : p.version === 4
      ? `${(2 ** (32 - p.prefix)).toLocaleString()} addresses, ${p.network} to ${end}`
      : `IPv6 range (/${p.prefix})`;
  return {
    ok: true,
    cidr: `${p.network}/${p.prefix}`,
    version: p.version,
    prefix: p.prefix,
    covers,
  };
}
