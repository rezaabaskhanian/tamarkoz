import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

// Cafe Bazaar in-app billing through Poolakey (Kotlin: com.tamarkoz.focus.BillingModule).
export interface Spec extends TurboModule {
  isBazaarInstalled(): Promise<boolean>;
  getSkuDetails(inAppIdsJson: string, subsIdsJson: string): Promise<string>;
  purchase(productId: string, isSubscription: boolean): Promise<string>;
  getPurchases(): Promise<string>;
  consume(purchaseToken: string): Promise<string>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('NativeBilling');
