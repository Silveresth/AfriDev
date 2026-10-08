import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { I18nManager } from 'react-native';

/**
 * Icônes directionnelles : elles pointent dans le sens de lecture. Le sens est fixé au
 * démarrage de l'appli (arabe : de droite à gauche), il suffit donc de le lire une fois.
 */
export const BackArrow = I18nManager.isRTL ? ArrowRight : ArrowLeft;
export const ForwardChevron = I18nManager.isRTL ? ChevronLeft : ChevronRight;
