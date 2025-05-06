// src/components/common/NotificationSystem.js
import { CheckCircle, AlertCircle, Info, X } from "lucide-react";

/**
 * Sistema di notifiche dell'applicazione
 * 
 * @param {Object} props - Proprietà del componente
 * @param {Array} props.notifications - Array di notifiche da visualizzare
 * @param {Function} props.onRemove - Funzione per rimuovere una notifica
 */
const NotificationSystem = ({ notifications, onRemove }) => {
  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80">
      {notifications.map(notification => (
        <Notification 
          key={notification.id}
          notification={notification}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
};

/**
 * Componente singola notifica
 * 
 * @param {Object} props - Proprietà del componente
 * @param {Object} props.notification - Dati della notifica
 * @param {Function} props.onRemove - Funzione per rimuovere la notifica
 */
const Notification = ({ notification, onRemove }) => {
  const { id, message, type } = notification;

  // Determina lo stile in base al tipo di notifica
  const getNotificationStyle = () => {
    switch (type) {
      case 'success': return 'bg-green-500 text-white';
      case 'error': return 'bg-red-500 text-white';
      case 'warning': return 'bg-amber-500 text-white';
      default: return 'bg-blue-500 text-white'; // info o default
    }
  };

  // Determina l'icona in base al tipo di notifica
  const getNotificationIcon = () => {
    switch (type) {
      case 'success': return <CheckCircle size={18} className="mr-2" />;
      case 'error': return <AlertCircle size={18} className="mr-2" />;
      case 'warning': return <AlertCircle size={18} className="mr-2" />;
      default: return <Info size={18} className="mr-2" />; // info o default
    }
  };

  return (
    <div className={`mb-2 p-3 rounded-lg shadow-lg flex justify-between items-center ${getNotificationStyle()}`}>
      <div className="flex items-center">
        {getNotificationIcon()}
        <p>{message}</p>
      </div>
      <button 
        onClick={() => onRemove(id)}
        className="ml-2 text-white hover:text-gray-200"
        aria-label="Close notification"
      >
        <X size={18} />
      </button>
    </div>
  );
};

export default NotificationSystem;