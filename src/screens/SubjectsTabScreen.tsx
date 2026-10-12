import { Pressable, View } from 'react-native';
import { useDataQuery } from '../app/hooks';
import { useNav } from '../app/RootNavigator';
import { AppText } from '../components/AppText';
import { Icon } from '../components/Icon';
import { Screen } from '../components/Screen';
import { Button, Card, Pill, Row, SubjectDot } from '../components/ui';
import { SESSION_KINDS } from '../db/topics';
import { subjectOverview, type SubjectOverview } from '../services/subjectStats';
import { useApp } from '../state/AppContext';
import { makeStyles, radius, spacing, useTheme } from '../theme';
import { formatDurationFa, formatHMFa, toFaDigits } from '../utils/digits';
import { daysBetween } from '../utils/jalali';

/** «درس‌ها» tab: how much each subject was studied, split by type and by chapter/topic. */
export function SubjectsTabScreen() {
  const nav = useNav();
  const { colors } = useTheme();
  const { active } = useApp();
  const list = useDataQuery(() => subjectOverview(), []);

  const totalSec = list?.reduce((a, b) => a + b.totalSec, 0) ?? 0;
  const weekSec = list?.reduce((a, b) => a + b.weekSec, 0) ?? 0;

  return (
    <Screen
      title="درس‌ها"
      right={
        <Pressable onPress={() => nav.navigate('Subjects')} hitSlop={10} accessibilityLabel="ویرایش درس‌ها">
          <Pill label="ویرایش درس‌ها" icon="edit" tone="primary" />
        </Pressable>
      }
    >
      {list && list.length > 0 && (
        <Card tone="tint">
          <Row style={{ justifyContent: 'space-around' }}>
            <View style={{ alignItems: 'center' }}>
              <AppText variant="title">{formatHMFa(Math.round(weekSec / 60))}</AppText>
              <AppText variant="caption" muted>
                ساعت این هفته
              </AppText>
            </View>
            <View style={{ alignItems: 'center' }}>
              <AppText variant="title">{formatHMFa(Math.round(totalSec / 60))}</AppText>
              <AppText variant="caption" muted>
                ساعت از اول
              </AppText>
            </View>
            <View style={{ alignItems: 'center' }}>
              <AppText variant="title">{toFaDigits(list.length)}</AppText>
              <AppText variant="caption" muted>
                درس
              </AppText>
            </View>
          </Row>
        </Card>
      )}

      {list && list.length === 0 && (
        <Card>
          <AppText>هنوز درسی نداری. درس‌هایت را اضافه کن.</AppText>
          <Button title="افزودن درس" icon="add" onPress={() => nav.navigate('Subjects')} />
        </Card>
      )}

      {list?.map(s => (
        <SubjectCard
          key={s.id}
          s={s}
          onStart={active ? undefined : () => nav.navigate('StartSession', { subjectId: s.id })}
        />
      ))}

      {list && list.length > 0 && (
        <Row style={{ justifyContent: 'center' }}>
          <Icon name="book" size={16} color={colors.textMuted} />
          <AppText variant="caption" muted>
            موقع شروع جلسه، فصل یا مبحث را انتخاب کن تا این‌جا جدا حساب شود.
          </AppText>
        </Row>
      )}
    </Screen>
  );
}

const KIND_COLORS = (c: { primary: string; strict: string; warning: string }) => ({
  study: c.primary,
  practice: c.strict,
  test: c.warning,
});

function SubjectCard({ s, onStart }: { s: SubjectOverview; onStart?: () => void }) {
  const { colors } = useTheme();
  const st = useStyles();
  const kindColors = KIND_COLORS(colors);
  const kindTotal = s.kinds.study + s.kinds.practice + s.kinds.test;
  const ago = s.lastAt ? daysBetween(s.lastAt, Date.now()) : -1;
  const maxTopic = Math.max(1, ...s.topics.map(t => t.sec));

  return (
    <Card>
      <Row>
        <View style={[st.badge, { backgroundColor: s.color + '1A' }]}>
          <SubjectDot color={s.color} size={14} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText weight="bold" variant="subtitle">
            {s.name}
          </AppText>
          <AppText variant="caption" muted>
            {ago < 0
              ? 'هنوز جلسه‌ای ثبت نشده'
              : ago === 0
                ? 'آخرین مطالعه: امروز'
                : ago === 1
                  ? 'آخرین مطالعه: دیروز'
                  : `آخرین مطالعه: ${toFaDigits(ago)} روز پیش`}
          </AppText>
        </View>
        {onStart && (
          <Pressable onPress={onStart} hitSlop={8} style={st.play} accessibilityLabel={`شروع جلسه‌ی ${s.name}`}>
            <Icon name="lock" size={18} color="#FFFFFF" />
          </Pressable>
        )}
      </Row>

      <View style={st.stats}>
        <View style={st.stat}>
          <AppText weight="bold">{formatDurationFa(Math.round(s.weekSec / 60))}</AppText>
          <AppText variant="caption" muted>
            این هفته
          </AppText>
        </View>
        <View style={st.stat}>
          <AppText weight="bold">{formatDurationFa(Math.round(s.totalSec / 60))}</AppText>
          <AppText variant="caption" muted>
            از اول
          </AppText>
        </View>
        {s.tests > 0 && (
          <View style={st.stat}>
            <AppText weight="bold">{toFaDigits(s.tests)}</AppText>
            <AppText variant="caption" muted>
              تست
            </AppText>
          </View>
        )}
      </View>

      {kindTotal > 0 && (
        <View style={{ gap: 6 }}>
          <View style={st.splitBar}>
            {SESSION_KINDS.map(k =>
              s.kinds[k.value] > 0 ? (
                <View key={k.value} style={{ flex: s.kinds[k.value], backgroundColor: kindColors[k.value] }} />
              ) : null,
            )}
          </View>
          <Row gap={spacing.md} style={{ flexWrap: 'wrap' }}>
            {SESSION_KINDS.map(k => (
              <Row key={k.value} gap={4}>
                <SubjectDot color={kindColors[k.value]} size={8} />
                <AppText variant="caption" muted>
                  {k.label} {toFaDigits(Math.round((s.kinds[k.value] / kindTotal) * 100))}٪
                </AppText>
              </Row>
            ))}
          </Row>
        </View>
      )}

      {s.topics.length > 0 && (
        <View style={{ gap: spacing.sm }}>
          <AppText variant="caption" weight="bold" muted>
            مبحث‌های پرکار
          </AppText>
          {s.topics.map(t => (
            <View key={t.name} style={{ gap: 3 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <AppText variant="caption" weight="medium" style={{ flex: 1 }} numberOfLines={1}>
                  {t.name}
                </AppText>
                <AppText variant="caption" muted>
                  {formatDurationFa(Math.round(t.sec / 60))} · {toFaDigits(t.sessions)} جلسه
                </AppText>
              </Row>
              <View style={st.topicTrack}>
                <View style={[st.topicFill, { width: `${(t.sec / maxTopic) * 100}%`, backgroundColor: s.color }]} />
              </View>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

const useStyles = makeStyles(c => ({
  badge: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  play: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, backgroundColor: c.surfaceAlt, borderRadius: radius.md, padding: spacing.sm + 2, gap: 2 },
  splitBar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: c.surfaceAlt },
  topicTrack: { height: 6, borderRadius: 3, backgroundColor: c.surfaceAlt, overflow: 'hidden' },
  topicFill: { height: 6, borderRadius: 3 },
}));
