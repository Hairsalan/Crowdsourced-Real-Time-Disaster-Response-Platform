// This file force-unregisters any service workers to fix flickering issues

// Unregister any service workers
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for (let registration of registrations) {
      console.log("Unregistering service worker:", registration);
      registration.unregister();
    }
    console.log("Service worker cleanup completed");
  }).catch(function(err) {
    console.log('Service Worker unregistration failed: ', err);
  });
}

// Clean up localStorage of any notification-related items
function cleanupLocalStorage() {
  try {
    // Only clean notification-related items, not user data
    const keysToCheck = Object.keys(localStorage);
    
    const notificationKeywords = ['notification', 'Notification', 'notify', 'Notify', 'alert', 'Alert'];
    
    keysToCheck.forEach(key => {
      const shouldRemove = notificationKeywords.some(keyword => key.includes(keyword));
      if (shouldRemove) {
        console.log(`Cleaning up localStorage item: ${key}`);
        localStorage.removeItem(key);
      }
    });
    
    console.log("localStorage cleanup completed");
  } catch (err) {
    console.log('localStorage cleanup failed:', err);
  }
}

// Run cleanup on page load
cleanupLocalStorage(); 