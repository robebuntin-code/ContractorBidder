import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from './auth';
import { usePushNotifications } from './push';
import { colors } from './theme';
import AppTabBar from './components/AppTabBar';
import { UnreadNotificationsProvider } from './unreadNotifications';
import type {
  ActivityStackParamList,
  FindStackParamList,
  MyJobsStackParamList,
  ProfileStackParamList,
  RootStackParamList,
  TabParamList,
} from './navTypes';
import LoginScreen from './screens/LoginScreen';
import FindJobsScreen from './screens/FindJobsScreen';
import MyJobsScreen from './screens/MyJobsScreen';
import ActivityScreen from './screens/ActivityScreen';
import ProfileScreen from './screens/ProfileScreen';
import JobDetailScreen from './screens/JobDetailScreen';
import PostJobScreen from './screens/PostJobScreen';
import ContractorProfileScreen from './screens/ContractorProfileScreen';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const postJobScreenOptions = ({ route }: { route: { params?: { jobId?: string } } }) => ({
  title: route.params?.jobId ? 'Edit job' : 'Post a job',
});

const stackScreenOptions = {
  headerStyle: { backgroundColor: colors.surface },
  headerShadowVisible: false,
  headerTitleStyle: { fontWeight: '600' as const, color: colors.text, fontSize: 17 },
  headerTintColor: colors.primary,
  headerBackTitle: 'Back',
  contentStyle: { backgroundColor: colors.bg },
};

const FindStack = createNativeStackNavigator<FindStackParamList>();
function FindTabStack() {
  return (
    <FindStack.Navigator screenOptions={stackScreenOptions}>
      <FindStack.Screen name="Find" component={FindJobsScreen} options={{ headerShown: false }} />
      <FindStack.Screen name="JobDetail" component={JobDetailScreen} options={{ title: 'Job details' }} />
      <FindStack.Screen name="PostJob" component={PostJobScreen} options={postJobScreenOptions} />
      <FindStack.Screen
        name="ContractorProfile"
        component={ContractorProfileScreen}
        options={{ title: 'Contractor' }}
      />
    </FindStack.Navigator>
  );
}

const MyJobsStack = createNativeStackNavigator<MyJobsStackParamList>();
function MyJobsTabStack() {
  return (
    <MyJobsStack.Navigator screenOptions={stackScreenOptions}>
      <MyJobsStack.Screen name="MyJobs" component={MyJobsScreen} options={{ headerShown: false }} />
      <MyJobsStack.Screen name="JobDetail" component={JobDetailScreen} options={{ title: 'Job details' }} />
      <MyJobsStack.Screen name="PostJob" component={PostJobScreen} options={postJobScreenOptions} />
      <MyJobsStack.Screen
        name="ContractorProfile"
        component={ContractorProfileScreen}
        options={{ title: 'Contractor' }}
      />
    </MyJobsStack.Navigator>
  );
}

const ActivityStack = createNativeStackNavigator<ActivityStackParamList>();
function ActivityTabStack() {
  return (
    <ActivityStack.Navigator screenOptions={stackScreenOptions}>
      <ActivityStack.Screen name="Activity" component={ActivityScreen} options={{ headerShown: false }} />
      <ActivityStack.Screen name="JobDetail" component={JobDetailScreen} options={{ title: 'Job details' }} />
      <ActivityStack.Screen name="PostJob" component={PostJobScreen} options={postJobScreenOptions} />
      <ActivityStack.Screen
        name="ContractorProfile"
        component={ContractorProfileScreen}
        options={{ title: 'Contractor' }}
      />
    </ActivityStack.Navigator>
  );
}

const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();
function ProfileTabStack() {
  return (
    <ProfileStack.Navigator screenOptions={stackScreenOptions}>
      <ProfileStack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false }} />
      <ProfileStack.Screen name="JobDetail" component={JobDetailScreen} options={{ title: 'Job details' }} />
      <ProfileStack.Screen name="PostJob" component={PostJobScreen} options={postJobScreenOptions} />
      <ProfileStack.Screen
        name="ContractorProfile"
        component={ContractorProfileScreen}
        options={{ title: 'Contractor' }}
      />
    </ProfileStack.Navigator>
  );
}

function MainTabs() {
  const { user } = useAuth();
  const isContractor = user?.role === 'CONTRACTOR';

  return (
    <UnreadNotificationsProvider>
      <Tab.Navigator
        initialRouteName={isContractor ? 'Find' : 'MyJobs'}
        tabBar={(props) => <AppTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          tabBarHideOnKeyboard: true,
        }}
      >
        {isContractor ? (
          <Tab.Screen name="Find" component={FindTabStack} options={{ title: 'Find' }} />
        ) : null}
        <Tab.Screen name="MyJobs" component={MyJobsTabStack} options={{ title: 'Jobs' }} />
        <Tab.Screen name="Activity" component={ActivityTabStack} options={{ title: 'Activity' }} />
        <Tab.Screen name="Profile" component={ProfileTabStack} options={{ title: 'Profile' }} />
      </Tab.Navigator>
    </UnreadNotificationsProvider>
  );
}

export default function RootNavigator() {
  const { user, loading } = useAuth();
  usePushNotifications(!!user);

  if (loading) return null;

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <RootStack.Screen name="Main" component={MainTabs} />
      ) : (
        <RootStack.Screen name="Login" component={LoginScreen} />
      )}
    </RootStack.Navigator>
  );
}
