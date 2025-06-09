import { motion } from 'framer-motion';

const SecondaryButton = ({ children, className = '', ...props }) => {
  return (
    <motion.button
      className={`secondary-button ${className}`}
      variants={buttonVariants}
      initial="hidden"
      animate="visible"
      whileHover="hover"
      whileTap="tap"
      {...props}
    >
      {children}
    </motion.button>
  );
};

export default SecondaryButton;

