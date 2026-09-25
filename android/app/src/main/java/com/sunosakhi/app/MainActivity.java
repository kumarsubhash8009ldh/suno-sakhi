package com.sunosakhi.app;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.media.AudioManager;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int CALL_PERMISSIONS_REQUEST_CODE = 101;

    // Javascript interface exposed to WebView as window.AndroidSecurity
    public class SecurityInterface {
        @JavascriptInterface
        public void setSecureScreen(final boolean secure) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    applyScreenSecurity(secure);
                }
            });
        }
    }

    private void applyScreenSecurity(boolean secure) {
        try {
            if (secure) {
                // FLAG_SECURE prevents hardware screenshots and screen recording (produces black screen)
                getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
            } else {
                getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ScreenSecurityPlugin.class);
        super.onCreate(savedInstanceState);

        String[] permissions = {
            Manifest.permission.CAMERA,
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.MODIFY_AUDIO_SETTINGS
        };

        boolean needsRequest = false;
        for (String perm : permissions) {
            if (ContextCompat.checkSelfPermission(this, perm) != PackageManager.PERMISSION_GRANTED) {
                needsRequest = true;
                break;
            }
        }

        if (needsRequest) {
            ActivityCompat.requestPermissions(this, permissions, CALL_PERMISSIONS_REQUEST_CODE);
        }

        configureAudioAndMedia();
        setupSecurityBridge();
    }

    @Override
    public void onResume() {
        super.onResume();
        configureAudioAndMedia();
        setupSecurityBridge();
    }

    private void setupSecurityBridge() {
        try {
            if (this.bridge != null && this.bridge.getWebView() != null) {
                this.bridge.getWebView().addJavascriptInterface(new SecurityInterface(), "AndroidSecurity");
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void configureAudioAndMedia() {
        try {
            if (this.bridge != null && this.bridge.getWebView() != null) {
                this.bridge.getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false);
            }
            AudioManager audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
            if (audioManager != null) {
                audioManager.setMode(AudioManager.MODE_NORMAL);
                audioManager.setSpeakerphoneOn(true);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
