// Consolidated Footer Component re-export (DEV-100 / SU-T22)
// Eliminates dead buttons, hides unapproved Privacy/Terms (D-07), and displays verified contacts/links.
import { Footer as LayoutFooter } from './layout/Footer';

export const Footer = (props) => <LayoutFooter {...props} />;
export default Footer;
