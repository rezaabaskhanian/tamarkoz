/**
 * @format
 */

import { AppRegistry, I18nManager } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

// RTL is also forced natively in MainApplication; this keeps JS in agreement.
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

AppRegistry.registerComponent(appName, () => App);
