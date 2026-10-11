import { useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { AppText } from '../components/AppText';
import { Icon } from '../components/Icon';
import { TextField } from '../components/Pickers';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { Button, Card, Divider, ListItem, Row, SubjectDot } from '../components/ui';
import {
  addSubject,
  listSubjects,
  moveSubject,
  removeSubject,
  SUBJECT_COLORS,
  unarchiveSubject,
  updateSubject,
  type Subject,
} from '../db/subjects';
import { useApp } from '../state/AppContext';
import { radius, spacing, useTheme } from '../theme';

/** F09: add, rename, recolor, reorder; subjects with history are archived, not deleted. */
export function SubjectsScreen() {
  const { subjects, reloadSubjects, active, bumpData } = useApp();
  const { colors } = useTheme();
  const [archived, setArchived] = useState<Subject[]>([]);
  const [editing, setEditing] = useState<Subject | 'new' | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(SUBJECT_COLORS[0]);

  const reload = async () => {
    await reloadSubjects();
    setArchived((await listSubjects(true)).filter(s => s.archived));
    bumpData();
  };

  useEffect(() => {
    listSubjects(true).then(list => setArchived(list.filter(s => s.archived)));
  }, []);

  const openEditor = (s: Subject | 'new') => {
    setEditing(s);
    setName(s === 'new' ? '' : s.name);
    setColor(s === 'new' ? SUBJECT_COLORS[subjects.length % SUBJECT_COLORS.length] : s.color);
  };

  const save = async () => {
    if (!name.trim()) return;
    if (editing === 'new') await addSubject(name, color);
    else if (editing) await updateSubject(editing.id, name, color);
    setEditing(null);
    await reload();
  };

  const remove = (s: Subject) => {
    if (active?.subjectId === s.id) {
      Alert.alert('در حال استفاده', 'این درس در جلسه‌ی فعلی است. بعد از جلسه دوباره امتحان کن.');
      return;
    }
    Alert.alert(`حذف «${s.name}»؟`, 'اگر جلسه‌ای با این درس ثبت شده باشد، بایگانی می‌شود تا گزارش‌های قبلی درست بمانند.', [
      { text: 'نه', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          const r = await removeSubject(s.id);
          setEditing(null);
          await reload();
          if (r === 'archived') Alert.alert('بایگانی شد', 'درس از فهرست برداشته شد ولی در گزارش‌ها می‌ماند.');
        },
      },
    ]);
  };

  return (
    <Screen
      title="درس‌ها"
      back
      footer={<Button title="افزودن درس" icon="add" onPress={() => openEditor('new')} />}
    >
      {subjects.length === 0 && <AppText muted>هنوز درسی نداری. درس‌هایت را اضافه کن.</AppText>}
      {subjects.length > 0 && (
        <Card>
          {subjects.map((s, i) => (
            <View key={s.id}>
              {i > 0 && <Divider />}
              <ListItem
                title={s.name}
                left={<SubjectDot color={s.color} size={14} />}
                onPress={() => openEditor(s)}
                right={
                  <Row gap={4}>
                    <Pressable hitSlop={6} disabled={i === 0} onPress={async () => { await moveSubject(s.id, -1); await reload(); }} style={{ opacity: i === 0 ? 0.25 : 1 }} accessibilityLabel="بالاتر">
                      <Icon name="up" color={colors.textMuted} />
                    </Pressable>
                    <Pressable hitSlop={6} disabled={i === subjects.length - 1} onPress={async () => { await moveSubject(s.id, 1); await reload(); }} style={{ opacity: i === subjects.length - 1 ? 0.25 : 1 }} accessibilityLabel="پایین‌تر">
                      <Icon name="down" color={colors.textMuted} />
                    </Pressable>
                  </Row>
                }
              />
            </View>
          ))}
        </Card>
      )}
      {archived.length > 0 && (
        <Card>
          <AppText weight="bold">بایگانی</AppText>
          {archived.map(s => (
            <ListItem
              key={s.id}
              title={s.name}
              left={<SubjectDot color={s.color} />}
              right={
                <Button
                  title="برگرداندن"
                  size="sm"
                  variant="ghost"
                  onPress={async () => {
                    await unarchiveSubject(s.id);
                    await reload();
                  }}
                />
              }
            />
          ))}
        </Card>
      )}

      <Sheet visible={editing != null} onClose={() => setEditing(null)} title={editing === 'new' ? 'درس تازه' : 'ویرایش درس'}>
        <TextField value={name} onChange={setName} placeholder="نام درس" autoFocus />
        <Row style={{ flexWrap: 'wrap' }}>
          {SUBJECT_COLORS.map(c => (
            <Pressable
              key={c}
              onPress={() => setColor(c)}
              accessibilityLabel="رنگ"
              style={{
                width: 36,
                height: 36,
                borderRadius: radius.pill,
                backgroundColor: c,
                borderWidth: 3,
                borderColor: color === c ? colors.text : 'transparent',
              }}
            />
          ))}
        </Row>
        <Button title="ذخیره" disabled={!name.trim()} onPress={save} />
        {editing && editing !== 'new' && (
          <Button title="حذف درس" variant="danger" onPress={() => remove(editing)} />
        )}
        <View style={{ height: spacing.sm }} />
      </Sheet>
    </Screen>
  );
}
