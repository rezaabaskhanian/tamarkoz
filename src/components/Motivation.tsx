import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useApp } from '../state/AppContext';
import { makeStyles, radius, spacing, useTheme } from '../theme';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { TextField } from './Pickers';
import { Sheet } from './Sheet';
import { Button, Card, Row } from './ui';

const EXAMPLES = ['پزشکی دانشگاه تهران', 'اولین مهندس خانواده', 'استقلال مالی', 'ثابت کنم که می‌توانم'];

/** «چرا درس می‌خوانم؟» editor. The answer shows on home and on the lock screen. */
export function MotivationSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { settings, setSetting } = useApp();
  const { colors } = useTheme();
  const s = useStyles();
  const [text, setText] = useState(settings.motivation);

  useEffect(() => {
    if (visible) setText(settings.motivation);
  }, [visible, settings.motivation]);

  const save = async () => {
    await setSetting('motivation', text.trim());
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="چرا درس می‌خوانم؟">
      <AppText variant="caption" muted>
        بدون یک «چرا»ی روشن، حتی یک ساعت درس هم سخت است. هدفت را کوتاه بنویس؛ هر بار که سراغ اپ
        ممنوع بروی، روی صفحه‌ی قفل همین را می‌بینی.
      </AppText>
      <TextField value={text} onChange={setText} placeholder="مثلاً: پزشکی دانشگاه تهران" maxLength={80} autoFocus />
      <View style={s.examples}>
        {EXAMPLES.map(e => (
          <AppText
            key={e}
            variant="caption"
            weight="medium"
            color={colors.pink}
            style={[s.example, { backgroundColor: colors.pinkSoft }]}
            onPress={() => setText(e)}
          >
            {e}
          </AppText>
        ))}
      </View>
      <Button title="ذخیره" icon="check" onPress={save} />
      {settings.motivation ? (
        <Button
          title="پاک کردن"
          variant="secondary"
          onPress={async () => {
            await setSetting('motivation', '');
            onClose();
          }}
        />
      ) : null}
    </Sheet>
  );
}

/** Home card: the user's reason, or an invitation to write one. */
export function MotivationCard() {
  const { settings } = useApp();
  const { colors } = useTheme();
  const s = useStyles();
  const [open, setOpen] = useState(false);
  const text = settings.motivation.trim();
  return (
    <>
      <Card onPress={() => setOpen(true)} style={[s.card, { backgroundColor: colors.pinkSoft }]}>
        <Row gap={spacing.md}>
          <View style={[s.icon, { backgroundColor: colors.pink }]}>
            <Icon name="target" size={20} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="caption" muted>
              {text ? 'چرا درس می‌خوانم؟' : 'هدف بزرگت چیست؟'}
            </AppText>
            <AppText weight="bold" color={colors.pink} numberOfLines={2}>
              {text ? `«${text}»` : 'بنویس تا روی صفحه‌ی قفل یادت بیاید'}
            </AppText>
          </View>
          <Icon name={text ? 'edit' : 'add'} size={18} color={colors.pink} />
        </Row>
      </Card>
      <MotivationSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const useStyles = makeStyles(() => ({
  card: { borderWidth: 0 },
  icon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  examples: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  example: { borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 4, overflow: 'hidden' },
}));
