import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTelegram } from '../hooks/useTelegram';
import { useToast } from '../components/Toast';
import LoadingSpinner from '../components/LoadingSpinner';
import { useApi } from '../hooks/useApi';
import { useI18n } from '../i18n/I18nProvider';
import { getUserDetail, deleteAdminUser, deleteAdminUserProfile, getMe } from '../api/endpoints';
import { getMockAdminUserDetail, deleteMockAdminUser, deleteMockAdminUserProfile, mockMe } from '../api/mock';
import type { AdminUserDetail, MeResponse } from '../types';

const ROLE_BADGE: Record<string, string> = {
  admin: 'bg-accent-light text-accent',
  coach: 'bg-blue-500/10 text-blue-500',
  athlete: 'bg-green-500/10 text-green-500',
  none: 'bg-bg-divider text-text-disabled',
};

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2">
      <span className="text-[11px] text-text-disabled">{label}</span>
      <span className="text-[15px] text-text">{value}</span>
    </div>
  );
}

type DeleteTarget = 'user' | 'athlete' | 'coach';

export default function AdminUserProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showBackButton, isTelegram, hapticNotification } = useTelegram();
  const { showToast } = useToast();
  const { t } = useI18n();
  const [deleting, setDeleting] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<DeleteTarget | null>(null);

  useEffect(() => {
    return showBackButton(() => navigate(-1));
  }, []);

  const { data: me } = useApi<MeResponse>(getMe, mockMe, []);
  const mockDetail = getMockAdminUserDetail(id!);
  const { data: user, loading, refetch } = useApi<AdminUserDetail>(
    () => getUserDetail(id!),
    mockDetail,
    [id],
  );
  const isAdmin = me?.is_admin ?? false;

  if (loading) return <LoadingSpinner />;
  if (!user) return (
    <div className="flex flex-col items-center justify-center pt-20 px-4">
      <p className="text-sm text-text-secondary text-center">
        {t('profile.noUsersFound')}
      </p>
    </div>
  );

  const displayName = user.athlete?.full_name || user.coach?.full_name || user.username || `ID ${user.telegram_id}`;
  const initial = displayName.charAt(0);
  const hasBothProfiles = !!user.athlete && !!user.coach;

  const handleDeleteUser = async () => {
    setDeleting(true);
    try {
      await deleteAdminUser(user.id);
      hapticNotification('success');
      deleteMockAdminUser(user.id);
      showToast(t('profile.userDeleted'));
      navigate(-1);
    } catch {
      hapticNotification('error');
      showToast(t('common.error'), 'error');
      setDeleting(false);
    }
  };

  const handleDeleteProfile = async (role: 'athlete' | 'coach') => {
    setDeleting(true);
    try {
      await deleteAdminUserProfile(user.id, role);
      hapticNotification('success');
      deleteMockAdminUserProfile(user.id, role);
      showToast(t('profile.profileDeleted'));
      setConfirmTarget(null);
      setDeleting(false);
      refetch();
    } catch {
      hapticNotification('error');
      showToast(t('common.error'), 'error');
      setDeleting(false);
    }
  };

  const handleConfirm = () => {
    if (confirmTarget === 'user') handleDeleteUser();
    else if (confirmTarget === 'athlete') handleDeleteProfile('athlete');
    else if (confirmTarget === 'coach') handleDeleteProfile('coach');
  };

  const confirmMessage = confirmTarget === 'athlete'
    ? t('profile.deleteAthleteConfirm')
    : confirmTarget === 'coach'
      ? t('profile.deleteCoachConfirm')
      : t('profile.deleteUserConfirm');

  const createdDate = new Date(user.created_at).toLocaleDateString();

  return (
    <div>
      <div className="px-4 pt-4">
        {!isTelegram && (
          <button
            onClick={() => navigate(-1)}
            className="text-sm mb-3 border-none bg-transparent cursor-pointer text-accent"
          >
            {t('common.back')} ←
          </button>
        )}
      </div>

      {/* Avatar + name + role */}
      <div className="flex flex-col items-center pb-4 px-4">
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-medium bg-accent-light text-accent mb-3"
          style={{ border: '1px solid var(--color-accent)' }}
        >
          {initial}
        </div>
        <h1 className="text-[22px] font-heading text-text-heading text-center">
          {displayName}
        </h1>
        <div className="flex items-center gap-2 mt-1">
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${ROLE_BADGE[user.role] || ROLE_BADGE.none}`}>
            {user.role}
          </span>
          {user.username && (
            <span className="text-sm text-text-secondary">@{user.username}</span>
          )}
        </div>
      </div>

      {/* Athlete stats */}
      {user.athlete && (
        <div className="px-4">
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-bg-secondary rounded-xl p-3 text-center">
              <p className="text-lg font-heading text-accent">{user.athlete.rating_points}</p>
              <p className="text-[11px] text-text-disabled">{t('profile.ratingLabel')}</p>
            </div>
            <div className="bg-bg-secondary rounded-xl p-3 text-center">
              <p className="text-lg font-heading text-accent">{user.stats.tournaments_count}</p>
              <p className="text-[11px] text-text-disabled">{t('profile.tourneys')}</p>
            </div>
            <div className="bg-bg-secondary rounded-xl p-3 text-center">
              <p className="text-lg font-heading text-accent">{user.stats.medals_count}</p>
              <p className="text-[11px] text-text-disabled">{t('profile.medals')}</p>
            </div>
          </div>

          <p className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-3">{t('profile.information')}</p>
          <InfoRow label={t('profile.city')} value={user.athlete.city} />
          {user.athlete.club && <InfoRow label={t('profile.club')} value={user.athlete.club} />}
          <InfoRow label={t('profile.weightLabel')} value={user.athlete.weight_category} />
          <InfoRow label={t('profile.sportRank')} value={user.athlete.sport_rank} />
        </div>
      )}

      {/* Coach data */}
      {user.coach && (
        <div className="px-4 mt-2">
          {!user.athlete && (
            <p className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-3">{t('profile.information')}</p>
          )}
          {user.athlete && (
            <p className="text-[11px] uppercase tracking-[1.5px] text-text-disabled mb-3 mt-4">{t('profile.roleCoach')}</p>
          )}
          <InfoRow label={t('profile.city')} value={user.coach.city} />
          <InfoRow label={t('profile.club')} value={user.coach.club} />
          <InfoRow label={t('profile.sportRank')} value={user.coach.qualification} />
          <InfoRow label={t('profile.verifiedLabel')} value={user.coach.is_verified ? t('profile.verified') : t('profile.pendingVerification')} />
        </div>
      )}

      {/* Member since */}
      <div className="px-4 mt-4">
        <InfoRow label={t('profile.memberSince')} value={createdDate} />
      </div>

      {/* Delete buttons — admin only */}
      {isAdmin && (
        <div className="px-4 mt-6 space-y-2">
          {confirmTarget ? (
            <div className="space-y-2">
              <p className="text-sm text-text-secondary text-center">{confirmMessage}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmTarget(null)}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold border border-border bg-transparent cursor-pointer text-text active:opacity-80 transition-all"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={deleting}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold border-none cursor-pointer bg-rose-500 text-white active:opacity-80 disabled:opacity-40 transition-all"
                >
                  {deleting ? t('common.deleting') : t('common.delete')}
                </button>
              </div>
            </div>
          ) : hasBothProfiles ? (
            <>
              <button
                onClick={() => setConfirmTarget('athlete')}
                className="w-full py-3 rounded-xl text-sm font-semibold border-none cursor-pointer bg-rose-500/10 text-rose-500 active:opacity-80 hover:bg-rose-500/20 transition-all"
              >
                {t('profile.deleteAthleteProfile')}
              </button>
              <button
                onClick={() => setConfirmTarget('coach')}
                className="w-full py-3 rounded-xl text-sm font-semibold border-none cursor-pointer bg-rose-500/10 text-rose-500 active:opacity-80 hover:bg-rose-500/20 transition-all"
              >
                {t('profile.deleteCoachProfile')}
              </button>
              <button
                onClick={() => setConfirmTarget('user')}
                className="w-full py-3 rounded-xl text-sm font-semibold border-none cursor-pointer bg-rose-500 text-white active:opacity-80 hover:bg-rose-600 transition-all"
              >
                {t('profile.deleteUser')}
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmTarget('user')}
              className="w-full py-3 rounded-xl text-sm font-semibold border-none cursor-pointer bg-rose-500/10 text-rose-500 active:opacity-80 hover:bg-rose-500/20 transition-all"
            >
              {t('profile.deleteUser')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
