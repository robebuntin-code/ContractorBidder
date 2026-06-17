import type { NavigatorScreenParams, CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

/** Screens pushed on top of any tab — tabs stay visible underneath. */
export type SharedStackParamList = {
  JobDetail: { jobId: string };
  PostJob: { jobId?: string } | undefined;
  ContractorProfile: { userId: string };
};

export type FindStackParamList = { Find: undefined } & SharedStackParamList;
export type MyJobsStackParamList = { MyJobs: undefined } & SharedStackParamList;
export type ActivityStackParamList = { Activity: undefined } & SharedStackParamList;
export type ProfileStackParamList = { Profile: undefined } & SharedStackParamList;

export type TabParamList = {
  Find: NavigatorScreenParams<FindStackParamList>;
  MyJobs: NavigatorScreenParams<MyJobsStackParamList>;
  Activity: NavigatorScreenParams<ActivityStackParamList>;
  Profile: NavigatorScreenParams<ProfileStackParamList>;
};

export type RootStackParamList = {
  Login: undefined;
  Main: NavigatorScreenParams<TabParamList>;
};

export type RootStackProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

export type TabScreenProps<T extends keyof TabParamList> = CompositeScreenProps<
  T extends 'Find'
    ? NativeStackScreenProps<FindStackParamList, 'Find'>
    : T extends 'MyJobs'
      ? NativeStackScreenProps<MyJobsStackParamList, 'MyJobs'>
      : T extends 'Activity'
        ? NativeStackScreenProps<ActivityStackParamList, 'Activity'>
        : NativeStackScreenProps<ProfileStackParamList, 'Profile'>,
  CompositeScreenProps<
    BottomTabScreenProps<TabParamList, T>,
    NativeStackScreenProps<RootStackParamList>
  >
>;

export type StackScreenProps<T extends keyof SharedStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<SharedStackParamList, T>,
  CompositeScreenProps<
    BottomTabScreenProps<TabParamList>,
    NativeStackScreenProps<RootStackParamList>
  >
>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
