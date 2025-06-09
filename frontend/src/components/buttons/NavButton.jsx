import { motion } from 'framer-motion';

const navButtonVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.3 }
  }
};

export const NavButton = ({ children, className = '', ...props }) => {
  return (
    <motion.button
      className={`nav-button ${className}`}
      variants={navButtonVariants}
      initial="hidden"
      animate="visible"
      {...props}
    >
      {children}
    </motion.button>
  );
};