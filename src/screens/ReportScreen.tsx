import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useDataQuery, usePaywall } from '../app/hooks';
import { useNav } from '../app/RootNavigator';
import { AppText } from '../components/AppText';
import { BarChart, SubjectBars } from '../components/Charts';
import { Icon } from '../components/Icon';
import { Screen } from '../components/Screen';
import { Button, Card, PremiumBadge, Row, Segmented, SubjectDot } from '../components/ui';
import { deleteSession } from '../db/sessions';
import { focus } from '../native/focus';
import { monthlyReport, subjectTrend, weeklyReport, type PeriodReport } from '../services/reports';
import { shareReportPdf } from '../services/reportPdf';
import { useApp } from '../state/AppContext';
import { makeStyles, radius, spacing, useTheme } from '../theme';
import { formatDurationFa, toFaDigits } from '../utils/digits';
import {
  addDays,
  formatJalaliDayMonth,
  JALALI_MONTHS,
  toJalali,
  weekdayIndex,
} from '../utils/jalali';

const SHORT_DAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

export function ReportScreen() {
  const { isPremium } = useApp();
  const paywall = usePaywall();
  const [tab, setTab] = useState<'week' | 'month'>('week');

  return (
    <Screen title="گزارش" right={!isPremium ? <PremiumBadge /> : undefined}>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'week', label: 'هفتگی' },
          { value: 'month', label: 'ماهانه' },
        ]}
      />
      {isPremium ? (
        tab === 'week' ? <Weekly /> : <Monthly />
      ) : (
        <LockedSample onBuy={() => paywall('report')} />
      )}
    </Screen>
  );
}

function Weekly() {
  const nav = useNav();
  const [offset, setOffset] = useState(0);
  const r = useDataQuery(() => weeklyReport(offset), [offset]);
  if (!r) return null;
  const today = weekdayIndex(Date.now());
  return (
    <>
      <PeriodNav
        label={`${formatJalaliDayMonth(r.from)} تا ${formatJalaliDayMonth(addDays(r.to, -1))}`}
        onPrev={() => setOffset(offset - 1)}
        onNext={offset < 0 ? () => setOffset(offset + 1) : undefined}
      />
      <Totals r={r} prevLabel="هفته‌ی قبل" />
      <Card>
        <AppText weight="bold">هر روز</AppText>
        <BarChart values={r.perDay} labels={SHORT_DAYS} highlight={offset === 0 ? today : undefined} />
      </Card>
      <Details r={r} />
      <Row>
        <Button title="ثبت دستی" icon="add" variant="secondary" style={{ flex: 1 }} onPress={() => nav.navigate('ManualLog')} />
        <Button
          title="اشتراک‌گذاری"
          icon="share"
          variant="secondary"
          style={{ flex: 1 }}
          disabled={r.total < 60}
          onPress={() =>
            focus.shareCard({
              title: 'مطالعه‌ی این هفته',
              value: formatDurationFa(Math.round(r.total / 60)),
              subtitle: `${formatJalaliDayMonth(r.from)} تا ${formatJalaliDayMonth(addDays(r.to, -1))}`,
              detail: `${toFaDigits(r.completed)} جلسه‌ی کامل`,
            })
          }
        />
      </Row>
      <PdfButton r={r} kind="week" />
      <SessionList r={r} />
    </>
  );
}

function Monthly() {
  const now = toJalali(Date.now());
  const [ym, setYm] = useState({ jy: now.jy, jm: now.jm });
  const r = useDataQuery(() => monthlyReport(ym.jy, ym.jm), [ym.jy, ym.jm]);
  const { colors } = useTheme();
  if (!r) return null;
  const isCurrent = ym.jy === now.jy && ym.jm === now.jm;
  const prev = () => setYm(ym.jm === 1 ? { jy: ym.jy - 1, jm: 12 } : { jy: ym.jy, jm: ym.jm - 1 });
  const next = () => setYm(ym.jm === 12 ? { jy: ym.jy + 1, jm: 1 } : { jy: ym.jy, jm: ym.jm + 1 });
  const trend = subjectTrend(r);
  const maxWeek = Math.max(1, ...trend.flatMap(t => t.weeks));
  return (
    <>
      <PeriodNav
        label={`${JALALI_MONTHS[ym.jm - 1]} ${toFaDigits(ym.jy)}`}
        onPrev={prev}
        onNext={isCurrent ? undefined : next}
      />
      <Totals r={r} prevLabel="ماه قبل" />
      <Card>
        <AppText weight="bold">هر روز</AppText>
        <BarChart
          values={r.perDay.slice(0, r.days)}
          labels={r.perDay.slice(0, r.days).map((_, i) => ((i + 1) % 5 === 0 || i === 0 ? toFaDigits(i + 1) : ''))}
          highlight={isCurrent ? now.jd - 1 : undefined}
          height={120}
        />
      </Card>
      {trend.length > 0 && (
        <Card>
          <AppText weight="bold">روند هر درس (هفته‌به‌هفته)</AppText>
          {trend.map(t => (
            <View key={t.name} style={{ gap: 4 }}>
              <Row>
                <SubjectDot color={t.color} />
                <AppText style={{ flex: 1 }}>{t.name}</AppText>
              </Row>
              <Row gap={4} style={{ alignItems: 'flex-end', height: 36 }}>
                {t.weeks.map((w, i) => (
                  <View
                    key={i}
                    style={{
                      flex: 1,
                      height: Math.max(w > 0 ? 3 : 1, (w / maxWeek) * 36),
                      backgroundColor: w > 0 ? t.color : colors.border,
                      borderRadius: 3,
                    }}
                  />
                ))}
              </Row>
            </View>
          ))}
        </Card>
      )}
      <Details r={r} />
      <PdfButton r={r} kind="month" />
    </>
  );
}

/** Counselor PDF: built on the phone, sent by the student through any app. */
function PdfButton({ r, kind }: { r: PeriodReport; kind: 'week' | 'month' }) {
  const { settings } = useApp();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      title="فایل PDF برای مشاور"
      icon="share"
      loading={busy}
      disabled={r.total < 60}
      onPress={async () => {
        setBusy(true);
        try {
          await shareReportPdf(r, kind, settings);
        } catch {
          Alert.alert('خطا', 'فایل PDF ساخته نشد.');
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}

function PeriodNav({ label, onPrev, onNext }: { label: string; onPrev: () => void; onNext?: () => void }) {
  const { colors } = useTheme();
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <Pressable onPress={onPrev} hitSlop={12} accessibilityLabel="دوره‌ی قبل">
        <Icon name="back" color={colors.primary} />
      </Pressable>
      <AppText weight="bold">{label}</AppText>
      <Pressable onPress={onNext} disabled={!onNext} hitSlop={12} accessibilityLabel="دوره‌ی بعد" style={{ opacity: onNext ? 1 : 0.25 }}>
        <View style={{ transform: [{ scaleX: -1 }] }}>
          <Icon name="back" color={colors.primary} />
        </View>
      </Pressable>
    </Row>
  );
}

function Totals({ r, prevLabel }: { r: PeriodReport; prevLabel: string }) {
  const { colors } = useTheme();
  return (
    <Card>
      <AppText muted variant="caption">
        مجموع مطالعه
      </AppText>
      <AppText variant="title">{formatDurationFa(Math.round(r.total / 60))}</AppText>
      {r.change != null ? (
        <AppText variant="caption" color={r.change >= 0 ? colors.success : colors.danger}>
          {r.change >= 0 ? '▲' : '▼'} {toFaDigits(Math.abs(r.change))}٪ نسبت به {prevLabel}
        </AppText>
      ) : (
        <AppText variant="caption" muted>
          {prevLabel} داده‌ای نبود
        </AppText>
      )}
    </Card>
  );
}

function Details({ r }: { r: PeriodReport }) {
  const s = useStyles();
  const stats: [string, string][] = [
    ['جلسه‌ی کامل', toFaDigits(r.completed)],
    ['جلسه‌ی ناتمام', toFaDigits(r.incomplete)],
    ['نوبت ردشده‌ی برنامه', toFaDigits(r.skippedBlocks)],
    ['باز کردن اپ ممنوع', toFaDigits(r.attempts)],
    ['تست', toFaDigits(r.tests)],
  ];
  return (
    <>
      {r.subjects.length > 0 && (
        <Card>
          <AppText weight="bold">سهم هر درس</AppText>
          <SubjectBars items={r.subjects} />
        </Card>
      )}
      <View style={s.grid}>
        {stats.map(([label, value]) => (
          <View key={label} style={s.stat}>
            <AppText variant="title">{value}</AppText>
            <AppText variant="caption" muted>
              {label}
            </AppText>
          </View>
        ))}
      </View>
    </>
  );
}

function SessionList({ r }: { r: PeriodReport }) {
  const { bumpData } = useApp();
  const { colors } = useTheme();
  const s = useStyles();
  if (r.sessions.length === 0) return null;
  const confirmDelete = (id: number) =>
    Alert.alert('حذف ثبت دستی؟', '', [
      { text: 'نه', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          await deleteSession(id);
          bumpData();
        },
      },
    ]);
  return (
    <Card>
      <AppText weight="bold">جلسه‌ها</AppText>
      {r.sessions.map(x => (
        <Pressable
          key={x.id}
          style={s.session}
          onLongPress={x.source === 'manual_log' ? () => confirmDelete(x.id) : undefined}
        >
          <SubjectDot color={x.subject_color} />
          <View style={{ flex: 1 }}>
            <AppText>{x.subject_name}</AppText>
            <AppText variant="caption" muted>
              {formatJalaliDayMonth(x.started_at)}
              {x.end_reason && x.end_reason !== 'completed' && x.source !== 'manual_log' ? ' · ناتمام' : ''}
              {x.tests_count ? ` · ${toFaDigits(x.tests_count)} تست` : ''}
            </AppText>
          </View>
          {x.source === 'manual_log' && (
            <View style={[s.tag, { backgroundColor: colors.warningSoft }]}>
              <AppText variant="caption" color={colors.warning}>
                دستی
              </AppText>
            </View>
          )}
          <AppText weight="medium">{formatDurationFa(Math.round(x.actual_seconds / 60))}</AppText>
        </Pressable>
      ))}
      <AppText variant="caption" muted>
        برای حذف ثبت دستی، رویش نگه دار.
      </AppText>
    </Card>
  );
}

/** Free users see a dimmed sample report with a purchase button (F14). */
function LockedSample({ onBuy }: { onBuy: () => void }) {
  const { colors } = useTheme();
  const s = useStyles();
  return (
    <View>
      <View style={s.dim} pointerEvents="none" importantForAccessibility="no-hide-descendants">
        <Card>
          <AppText variant="title">۲۸ ساعت و ۴۰ دقیقه</AppText>
          <BarChart values={[3, 5, 4, 6, 2, 5, 3]} labels={SHORT_DAYS} />
        </Card>
        <Card>
          <SubjectBars
            items={[
              { subjectId: 1, name: 'زیست‌شناسی', color: '#1F9D63', seconds: 9 },
              { subjectId: 2, name: 'شیمی', color: '#3E5BDB', seconds: 6 },
              { subjectId: 3, name: 'فیزیک', color: '#E0812B', seconds: 4 },
            ]}
          />
        </Card>
      </View>
      <View style={s.lockOverlay}>
        <Card style={{ alignItems: 'center' }}>
          <Icon name="lock" size={32} color={colors.primary} />
          <AppText weight="bold" center>
            گزارش هفتگی و ماهانه در نسخه‌ی کامل
          </AppText>
          <AppText variant="caption" muted center>
            خلاصه‌ی امروز در خانه همیشه رایگان است.
          </AppText>
          <Button title="دیدن نسخه‌ی کامل" icon="star" onPress={onBuy} />
        </Card>
      </View>
    </View>
  );
}

const useStyles = makeStyles(c => ({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stat: {
    flexGrow: 1,
    flexBasis: '30%',
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.md,
  },
  session: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6 },
  tag: { paddingHorizontal: 8, borderRadius: radius.pill },
  dim: { opacity: 0.25, gap: spacing.md },
  lockOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center' },
}));
