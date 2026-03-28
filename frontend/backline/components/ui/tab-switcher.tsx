import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { type ReactNode } from 'react';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

type TabConfig<T extends string> = {
  key: T;
  content: ReactNode;
};

type Props<T extends string> = {
  tabs: TabConfig<T>[];
  activeTab: T;
  onTabChange: (tab: T) => void;
  marginHorizontal?: number;
};

export function TabSwitcher<T extends string>({
  tabs,
  activeTab,
  onTabChange,
  marginHorizontal = 0,
}: Props<T>) {
  const borderColor = useThemeColor({}, 'text');
  const activeContent = tabs.find(t => t.key === activeTab)?.content;

  return (
    <View>
      <View style={[styles.tabBar, { borderColor, marginHorizontal: -marginHorizontal }]}>
        {tabs.map(({ key }) => (
          <TouchableOpacity
            key={key}
            style={[
              styles.tab,
              activeTab === key && { borderBottomColor: borderColor },
            ]}
            onPress={() => onTabChange(key)}
          >
            <ThemedText style={[
              styles.tabText,
              activeTab !== key && styles.tabTextInactive,
            ]}>
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.tabContent}>
        {activeContent}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 2,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextInactive: {
    opacity: 0.4,
  },
  tabContent: {
    paddingTop: 16,
  },
});