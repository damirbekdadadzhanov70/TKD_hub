import { useState } from 'react';
import Card from '../components/Card';
import EmptyState from '../components/EmptyState';
import FilterBar from '../components/FilterBar';
import LoadingSpinner from '../components/LoadingSpinner';
import { useApi } from '../hooks/useApi';
import { getRatings } from '../api/endpoints';
import { mockRatings } from '../api/mock';
import type { RatingEntry } from '../types';

const PODIUM_COLORS = ['#C9A96E', '#A8AEB5', '#B08D6E'];
const PODIUM_ORDER = [1, 0, 2]; // Display order: 2nd, 1st, 3rd

function Podium({ top3 }: { top3: RatingEntry[] }) {
  if (top3.length < 3) return null;

  const heights = ['h-28', 'h-22', 'h-18'];

  return (
    <div className="flex items-end justify-center gap-3 px-6 pt-6 pb-4">
      {PODIUM_ORDER.map((idx) => {
        const athlete = top3[idx];
        const rank = idx + 1;
        const isFirst = idx === 0;
        return (
          <div key={athlete.athlete_id} className="flex flex-col items-center flex-1">
            {/* Avatar */}
            <div className="relative mb-1.5">
              <div
                className={`${isFirst ? 'w-16 h-16' : 'w-12 h-12'} rounded-full flex items-center justify-center font-bold`}
                style={{
                  backgroundColor: PODIUM_COLORS[idx] + '25',
                  color: PODIUM_COLORS[idx],
                  border: `2.5px solid ${PODIUM_COLORS[idx]}`,
                  fontSize: isFirst ? '1.25rem' : '1rem',
                }}
              >
                {athlete.full_name.charAt(0)}
              </div>
              {isFirst && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-[#C9A96E]">
                    <path d="M2 4l3 12h14l3-12-5 4-5-6-5 6-5-4z" /><path d="M5 20h14a1 1 0 0 1 0 2H5a1 1 0 0 1 0-2z" />
                  </svg>
                </span>
              )}
            </div>
            <p className="text-xs font-semibold text-center truncate w-full text-text">
              {athlete.full_name.split(' ').pop()}
            </p>
            <p className="text-[11px] text-text-secondary truncate w-full text-center">
              {athlete.city}
            </p>
            <p className="text-xs font-bold text-accent mt-0.5">
              {athlete.rating_points} pts
            </p>
            {/* Podium block */}
            <div
              className={`w-full ${heights[idx]} rounded-t-xl flex items-start justify-center pt-2 mt-1.5`}
              style={{ backgroundColor: PODIUM_COLORS[idx] + '30' }}
            >
              <span className="text-xl font-bold" style={{ color: PODIUM_COLORS[idx] }}>
                {rank}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Rating() {
  const [country, setCountry] = useState('');
  const [weight, setWeight] = useState('');
  const [gender, setGender] = useState('');

  const { data: ratings, loading } = useApi<RatingEntry[]>(
    () => getRatings({
      country: country || undefined,
      weight_category: weight || undefined,
      gender: gender || undefined,
    }),
    mockRatings,
    [country, weight, gender],
  );

  const entries = ratings || [];
  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <div>
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-2xl font-bold text-text">
          Rating
        </h1>
      </div>

      <FilterBar
        filters={[
          {
            key: 'country',
            label: 'Countries',
            options: [
              { value: 'Kyrgyzstan', label: 'Kyrgyzstan' },
              { value: 'Kazakhstan', label: 'Kazakhstan' },
              { value: 'Uzbekistan', label: 'Uzbekistan' },
            ],
            value: country,
            onChange: setCountry,
          },
          {
            key: 'weight',
            label: 'Weights',
            options: [
              { value: '-54kg', label: '-54kg' },
              { value: '-58kg', label: '-58kg' },
              { value: '-63kg', label: '-63kg' },
              { value: '-68kg', label: '-68kg' },
              { value: '-74kg', label: '-74kg' },
              { value: '-80kg', label: '-80kg' },
              { value: '-87kg', label: '-87kg' },
              { value: '+87kg', label: '+87kg' },
            ],
            value: weight,
            onChange: setWeight,
          },
          {
            key: 'gender',
            label: 'Gender',
            options: [
              { value: 'M', label: 'Male' },
              { value: 'F', label: 'Female' },
            ],
            value: gender,
            onChange: setGender,
          },
        ]}
      />

      {loading ? (
        <LoadingSpinner />
      ) : entries.length === 0 ? (
        <EmptyState title="No ratings" description="No athletes match your filters" />
      ) : (
        <>
          <Podium top3={top3} />

          <div className="px-4">
            {rest.map((entry) => (
              <Card key={entry.athlete_id} className="!p-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold w-6 text-center text-muted">
                    {entry.rank}
                  </span>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 bg-accent-light text-accent">
                    {entry.full_name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate text-text">
                      {entry.full_name}
                    </p>
                    <p className="text-[11px] text-text-secondary">
                      {entry.city}, {entry.country} · {entry.weight_category}
                    </p>
                  </div>
                  <span className="font-bold text-sm text-accent">
                    {entry.rating_points}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
