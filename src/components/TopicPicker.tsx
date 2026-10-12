import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { addTopic, deleteTopic, listTopics, SESSION_KINDS, type SessionKind, type Topic } from '../db/topics';
import { makeStyles, radius, spacing, useTheme } from '../theme';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { TextField } from './Pickers';
import { Sheet } from './Sheet';
import { Button, Chip, Row, Segmented } from './ui';
import { showAlert } from './Dialog';

/**
 * What the session is about: an optional chapter/topic of the chosen subject
 * (saved per subject for next time) and the type — study, practice or test.
 */
export function TopicPicker({
  subjectId,
  topic,
  onTopic,
  kind,
  onKind,
}: {
  subjectId: number | null;
  topic: string | null;
  onTopic: (t: string | null) => void;
  kind: SessionKind;
  onKind: (k: SessionKind) => void;
}) {
  const { colors } = useTheme();
  const s = useStyles();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  const reload = (id: number) => listTopics(id).then(setTopics).catch(() => setTopics([]));

  useEffect(() => {
    onTopic(null);
    if (subjectId != null) reload(subjectId);
    else setTopics([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId]);

  const save = async () => {
    const n = name.trim();
    if (!n || subjectId == null) return;
    await addTopic(subjectId, n);
    await reload(subjectId);
    onTopic(n);
    setName('');
    setAdding(false);
  };

  const remove = (t: Topic) =>
    showAlert(`حذف «${t.name}» از فهرست؟`, 'جلسه‌های قبلی با این مبحث در گزارش می‌مانند.', [
      { text: 'نه', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          await deleteTopic(t.id);
          if (topic === t.name) onTopic(null);
          if (subjectId != null) reload(subjectId);
        },
      },
    ]);

  return (
    <View style={s.wrap}>
      <AppText weight="bold">نوع جلسه</AppText>
      <Segmented<SessionKind> value={kind} onChange={onKind} options={SESSION_KINDS} />

      {subjectId != null && (
        <>
          <Row style={{ justifyContent: 'space-between' }}>
            <AppText weight="bold">فصل یا مبحث</AppText>
            <AppText variant="caption" muted>
              اختیاری
            </AppText>
          </Row>
          <Row style={s.chips}>
            {topics.map(t => (
              <Pressable key={t.id} onLongPress={() => remove(t)} delayLongPress={400}>
                <Chip label={t.name} selected={topic === t.name} onPress={() => onTopic(topic === t.name ? null : t.name)} />
              </Pressable>
            ))}
            <Pressable onPress={() => setAdding(true)} style={s.add} accessibilityRole="button" accessibilityLabel="افزودن مبحث">
              <Icon name="add" size={16} color={colors.primary} />
              <AppText variant="caption" weight="medium" color={colors.primary}>
                {topics.length ? 'مبحث تازه' : 'افزودن فصل یا مبحث'}
              </AppText>
            </Pressable>
          </Row>
          {topics.length > 0 && (
            <AppText variant="caption" muted>
              برای حذف یک مبحث از فهرست، رویش نگه دار.
            </AppText>
          )}
        </>
      )}

      <Sheet visible={adding} onClose={() => setAdding(false)} title="فصل یا مبحث تازه">
        <TextField value={name} onChange={setName} placeholder="مثلاً: مشتق، فصل ۳، تست‌های کنکور ۱۴۰۳" autoFocus />
        <Button title="افزودن" disabled={!name.trim()} onPress={save} />
      </Sheet>
    </View>
  );
}

const useStyles = makeStyles(c => ({
  wrap: { gap: spacing.sm + 4 },
  chips: { flexWrap: 'wrap' },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    minHeight: 36,
    borderRadius: radius.chip,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: c.primary,
  },
}));
