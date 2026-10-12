package com.tamarkoz.focus

import androidx.activity.ComponentActivity
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.UiThreadUtil
import com.tamarkoz.BuildConfig
import com.tamarkoz.specs.NativeBillingSpec
import ir.cafebazaar.poolakey.Payment
import ir.cafebazaar.poolakey.config.PaymentConfiguration
import ir.cafebazaar.poolakey.config.SecurityCheck
import ir.cafebazaar.poolakey.entity.PurchaseInfo
import ir.cafebazaar.poolakey.entity.PurchaseState
import ir.cafebazaar.poolakey.exception.BazaarNotFoundException
import ir.cafebazaar.poolakey.request.PurchaseRequest
import org.json.JSONArray
import org.json.JSONObject

/**
 * Cafe Bazaar billing via Poolakey (F15). Purchase signatures are verified on the
 * device with Bazaar's public RSA key (BuildConfig.BAZAAR_RSA_KEY). The only network
 * traffic of the app goes through Bazaar here.
 * All results resolve as JSON {ok, error?, ...}; errors are codes JS turns into messages.
 */
class BillingModule(private val ctx: ReactApplicationContext) : NativeBillingSpec(ctx) {
  private var payment: Payment? = null
  private var connected = false
  private var connecting = false
  private val waiting = mutableListOf<Pair<(Payment) -> Unit, (String) -> Unit>>()

  private fun bazaarInstalled(): Boolean = InstalledApps.isInstalled(ctx, BAZAAR_PACKAGE)

  private fun errorCode(t: Throwable): String =
    when (t) {
      is BazaarNotFoundException -> "bazaar_not_installed"
      else -> t.javaClass.simpleName.ifEmpty { "failed" }
    }

  private fun err(code: String) = JSONObject().put("ok", false).put("error", code).toString()

  /** Runs [block] on the main thread once connected to Bazaar's billing service. */
  private fun withPayment(promise: Promise, block: (Payment) -> Unit) {
    if (!bazaarInstalled()) return promise.resolve(err("bazaar_not_installed"))
    if (BuildConfig.BAZAAR_RSA_KEY.isEmpty()) return promise.resolve(err("not_configured"))
    UiThreadUtil.runOnUiThread {
      val p =
        payment
          ?: Payment(ctx, PaymentConfiguration(localSecurityCheck = SecurityCheck.Enable(BuildConfig.BAZAAR_RSA_KEY))).also {
            payment = it
          }
      if (connected) {
        block(p)
        return@runOnUiThread
      }
      waiting.add(block to { code: String -> promise.resolve(err(code)) })
      if (connecting) return@runOnUiThread
      connecting = true
      p.connect {
        connectionSucceed {
          connected = true
          connecting = false
          val list = waiting.toList()
          waiting.clear()
          list.forEach { it.first(p) }
        }
        connectionFailed { t ->
          connected = false
          connecting = false
          val list = waiting.toList()
          waiting.clear()
          list.forEach { it.second(errorCode(t)) }
        }
        disconnected {
          connected = false
          connecting = false
        }
      }
    }
  }

  private fun PurchaseInfo.toJson(): JSONObject =
    JSONObject()
      .put("productId", productId)
      .put("purchaseToken", purchaseToken)
      .put("purchaseTime", purchaseTime)
      .put("orderId", orderId)
      .put("purchased", purchaseState == PurchaseState.PURCHASED)

  override fun isBazaarInstalled(promise: Promise) {
    promise.resolve(bazaarInstalled())
  }

  override fun getSkuDetails(inAppIdsJson: String, subsIdsJson: String, promise: Promise) {
    val inApp = JSONArray(inAppIdsJson).toStringList()
    val subs = JSONArray(subsIdsJson).toStringList()
    withPayment(promise) { p ->
      val out = JSONArray()
      fun put(list: List<ir.cafebazaar.poolakey.entity.SkuDetails>) =
        list.forEach { out.put(JSONObject().put("sku", it.sku).put("price", it.price).put("title", it.title)) }
      p.getInAppSkuDetails(inApp) {
        getSkuDetailsSucceed { list ->
          put(list)
          p.getSubscriptionSkuDetails(subs) {
            getSkuDetailsSucceed { s ->
              put(s)
              promise.resolve(JSONObject().put("ok", true).put("skus", out).toString())
            }
            getSkuDetailsFailed { promise.resolve(JSONObject().put("ok", true).put("skus", out).toString()) }
          }
        }
        getSkuDetailsFailed { t -> promise.resolve(err(errorCode(t))) }
      }
    }
  }

  override fun purchase(productId: String, isSubscription: Boolean, promise: Promise) {
    val activity = ctx.currentActivity as? ComponentActivity ?: return promise.resolve(err("no_activity"))
    withPayment(promise) { p ->
      val callback: ir.cafebazaar.poolakey.callback.PurchaseCallback.() -> Unit = {
        purchaseSucceed { info -> promise.resolve(JSONObject().put("ok", true).put("purchase", info.toJson()).toString()) }
        purchaseCanceled { promise.resolve(err("canceled")) }
        purchaseFailed { t -> promise.resolve(err(errorCode(t))) }
        failedToBeginFlow { t -> promise.resolve(err(errorCode(t))) }
      }
      val request = PurchaseRequest(productId = productId)
      if (isSubscription) p.subscribeProduct(activity.activityResultRegistry, request, callback)
      else p.purchaseProduct(activity.activityResultRegistry, request, callback)
    }
  }

  override fun getPurchases(promise: Promise) {
    withPayment(promise) { p ->
      p.getPurchasedProducts {
        querySucceed { inApp ->
          p.getSubscribedProducts {
            querySucceed { subs ->
              promise.resolve(
                JSONObject()
                  .put("ok", true)
                  .put("inApp", JSONArray(inApp.map { it.toJson() }))
                  .put("subs", JSONArray(subs.map { it.toJson() }))
                  .toString()
              )
            }
            queryFailed { t -> promise.resolve(err(errorCode(t))) }
          }
        }
        queryFailed { t -> promise.resolve(err(errorCode(t))) }
      }
    }
  }

  /**
   * Consumes a one-time purchase so it can be bought again. Called only after the
   * purchased period has expired — until then the unconsumed purchase is what lets
   * «بازیابی خرید» work after a reinstall (there is no server keeping it).
   */
  override fun consume(purchaseToken: String, promise: Promise) {
    withPayment(promise) { p ->
      p.consumeProduct(purchaseToken) {
        consumeSucceed { promise.resolve(JSONObject().put("ok", true).toString()) }
        consumeFailed { t -> promise.resolve(err(errorCode(t))) }
      }
    }
  }

  companion object {
    const val NAME = NativeBillingSpec.NAME
    private const val BAZAAR_PACKAGE = "com.farsitel.bazaar"
  }
}
