import { createApp } from 'vue'
import App from '@/App.vue'
import { registerPlugins } from '@core/utils/plugins'

// Styles
import '@core/scss/template/index.scss'

// La feuille de SweetAlert2 est importée ici, et avant `styles.scss`, pour que
// les surcharges `.te-toast` de ce dernier gagnent sans `!important`. Importée
// depuis `utils/toast.js`, elle serait injectée au premier appel — donc APRÈS
// nos règles.
import 'sweetalert2/dist/sweetalert2.min.css'
import '@styles/styles.scss'

// Create vue app
const app = createApp(App)


// Register plugins
registerPlugins(app)

// Mount vue app
app.mount('#app')
