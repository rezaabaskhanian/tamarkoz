package com.tamarkoz.focus

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class FocusPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    when (name) {
      FocusModule.NAME -> FocusModule(reactContext)
      BillingModule.NAME -> BillingModule(reactContext)
      else -> null
    }

  override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
    listOf(FocusModule.NAME, BillingModule.NAME).associateWith {
      ReactModuleInfo(it, it, false, false, false, true)
    }
  }
}
