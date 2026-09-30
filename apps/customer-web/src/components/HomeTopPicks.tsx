import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocale } from '../context/LocaleContext';

export type DietFilter = 'all' | 'veg' | 'nonveg';

export type TopPickItem = {
  id: string;
  label: { en: string; ta?: string };
  imageUrl?: string;
  searchQuery: string;
  diet?: 'veg' | 'nonveg' | 'both';
};

type Props = {
  title?: { en: string; ta?: string };
  picks: TopPickItem[];
};

const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=240&h=240&fit=crop',
  'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=240&h=240&fit=crop',
  'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=240&h=240&fit=crop',
];

const SAMPLE_BY_ID: Record<string, string> = {
  dosa: 'https://images.pexels.com/photos/5560763/pexels-photo-5560763.jpeg?auto=compress&cs=tinysrgb&w=240&h=240&fit=crop',
  noodles:
    'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=240&h=240&fit=crop',
};

const NONVEG_HINT = /\b(chicken|mutton|fish|egg|meat|prawn|non[\s-]?veg|keema|shawarma)\b/i;
const VEG_HINT = /\b(dosa|idli|paneer|veg|vegetarian|pulao|curd)\b/i;

function resolvePickImage(pick: TopPickItem, index: number): string {
  const sample = SAMPLE_BY_ID[pick.id];
  const raw = pick.imageUrl?.trim() ?? '';
  if (sample && !raw) return sample;
  if (raw) return raw;
  if (sample) return sample;
  return FALLBACK_IMAGES[index % FALLBACK_IMAGES.length]!;
}

function resolveDiet(pick: TopPickItem): 'veg' | 'nonveg' | 'both' {
  if (pick.diet) return pick.diet;
  const hay = `${pick.label?.en ?? ''} ${pick.searchQuery ?? ''}`;
  if (NONVEG_HINT.test(hay)) return 'nonveg';
  if (VEG_HINT.test(hay)) return 'veg';
  return 'both';
}

export function HomeTopPicks({ title, picks }: Props) {
  const { tName } = useLocale();
  const navigate = useNavigate();
  const [diet, setDiet] = useState<DietFilter>('all');

  const filtered = useMemo(() => {
    if (diet === 'all') return picks;
    return picks.filter((p) => {
      const d = resolveDiet(p);
      return d === diet || d === 'both';
    });
  }, [picks, diet]);

  if (!picks.length) return null;

  function toggle(next: 'veg' | 'nonveg') {
    setDiet((prev) => (prev === next ? 'all' : next));
  }

  function openPick(pick: TopPickItem) {
    const q = pick.searchQuery.trim();
    const pickDiet = resolveDiet(pick);
    const dietParam = diet !== 'all' ? diet : pickDiet === 'both' ? undefined : pickDiet;
    const params = new URLSearchParams({
      mode: 'topPick',
      q,
      title: tName(pick.label),
    });
    if (dietParam) params.set('diet', dietParam);
    navigate(`/search?${params.toString()}`);
  }

  return (
    <section className="qc-section qc-top-picks">
      <div className="qc-top-picks__head">
        {title ? <h2>{tName(title)}</h2> : <h2>Top picks</h2>}
        <div className="qc-diet-chips">
          <button
            type="button"
            className={`qc-diet-chip qc-diet-chip--veg ${diet === 'veg' ? 'is-active' : ''}`}
            onClick={() => toggle('veg')}
          >
            Veg
          </button>
          <button
            type="button"
            className={`qc-diet-chip qc-diet-chip--nonveg ${diet === 'nonveg' ? 'is-active' : ''}`}
            onClick={() => toggle('nonveg')}
          >
            Non-veg
          </button>
        </div>
      </div>
      <div className="qc-top-picks__row">
        {filtered.map((pick, i) => (
          <button
            key={pick.id}
            type="button"
            className="qc-top-pick"
            onClick={() => openPick(pick)}
          >
            <img src={resolvePickImage(pick, i)} alt="" loading="lazy" />
            <span>{tName(pick.label)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
