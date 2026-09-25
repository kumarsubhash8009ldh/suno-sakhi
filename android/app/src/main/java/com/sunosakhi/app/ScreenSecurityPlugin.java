package com.sunosakhi.app;

import android.view.WindowManager;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ScreenSecurity")
public class ScreenSecurityPlugin extends Plugin {

    @PluginMethod
    public void enable(PluginCall call) {
        if (getActivity() != null) {
            getActivity().runOnUiThread(() -> {
                try {
                    getActivity().getWindow().setFlags(
                        WindowManager.LayoutParams.FLAG_SECURE,
                        WindowManager.LayoutParams.FLAG_SECURE
                    );
                    call.resolve();
                } catch (Exception e) {
                    call.reject(e.getMessage());
                }
            });
        } else {
            call.resolve();
        }
    }

    @PluginMethod
    public void disable(PluginCall call) {
        if (getActivity() != null) {
            getActivity().runOnUiThread(() -> {
                try {
                    getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
                    call.resolve();
                } catch (Exception e) {
                    call.reject(e.getMessage());
                }
            });
        } else {
            call.resolve();
        }
    }
}
