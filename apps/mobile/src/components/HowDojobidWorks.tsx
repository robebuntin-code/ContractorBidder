import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HOW_DOJOBID_WORKS } from '@contractor-bidder/ui';
import { colors } from '../theme';

export function HowDojobidWorksModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={local.backdrop}>
        <Pressable style={local.dismiss} onPress={onClose} accessibilityLabel="Close" />
        <View style={[local.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={local.header}>
            <Text style={local.title}>{HOW_DOJOBID_WORKS.title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={local.close}>Done</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={local.body} showsVerticalScrollIndicator={false}>
            <Text style={local.intro}>{HOW_DOJOBID_WORKS.intro}</Text>

            {[HOW_DOJOBID_WORKS.homeowner, HOW_DOJOBID_WORKS.contractor].map((section) => (
              <View key={section.heading} style={local.section}>
                <Text style={local.sectionHeading}>{section.heading}</Text>
                {section.steps.map((step, index) => (
                  <View key={step.title} style={local.step}>
                    <Text style={local.stepTitle}>
                      {index + 1}. {step.title}
                    </Text>
                    <Text style={local.stepBody}>{step.body}</Text>
                  </View>
                ))}
              </View>
            ))}

            <View style={local.section}>
              <Text style={local.sectionHeading}>{HOW_DOJOBID_WORKS.messaging.title}</Text>
              <Text style={local.stepBody}>{HOW_DOJOBID_WORKS.messaging.body}</Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function HowDojobidWorksLink({ style }: { style?: object }) {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <TouchableOpacity onPress={() => setVisible(true)} style={style} activeOpacity={0.7}>
        <Text style={local.link}>How DOJOBID works</Text>
      </TouchableOpacity>
      <HowDojobidWorksModal visible={visible} onClose={() => setVisible(false)} />
    </>
  );
}

const local = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  dismiss: {
    flex: 1,
  },
  sheet: {
    maxHeight: '88%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  close: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  body: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 20,
  },
  intro: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
  section: {
    gap: 10,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  step: {
    gap: 4,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  stepBody: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
  },
  link: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
