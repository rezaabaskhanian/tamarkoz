package com.tamarkoz

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.modules.i18nmanager.I18nUtil
import com.tamarkoz.focus.FocusPackage

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          add(FocusPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    // The app is Persian-only: force RTL before React Native starts so even the first launch is RTL.
    I18nUtil.instance.allowRTL(this, true)
    I18nUtil.instance.forceRTL(this, true)
    loadReactNative(this)
  }
}
