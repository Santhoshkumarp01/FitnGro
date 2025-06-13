import { useState, useEffect } from 'react';
import './Chatbot.css';
import { db } from '../../services/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { auth } from '../../services/firebase';
import { color } from 'framer-motion';

const Chatbot = ({ userEmail, onGeneratePlan }) => {  
  const [isOpen, setIsOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [formData, setFormData] = useState({
    age: '',
    gender: '',
    height: '',
    weight: '',
    body_type: '',
    experience_level: '',
    activity_level: '',
    fitness_goal: '',
    rest_days: [],
  });
  const [conversationContext, setConversationContext] = useState({
    goal: null,
    experience: null
  });

  // Helper function to calculate BMI and generate response
 const calculateBMIResponse = (height,weight) => {  // Fix parameter order
  const heightInMeters = height / 100;
  const bmi = (weight / (heightInMeters * heightInMeters)).toFixed(1);
    let status;
    if (bmi < 18.5) {
        status = "underweight";
    } else if (bmi >= 18.5 && bmi < 25) {
        status = "at a healthy weight (ideal)";
    } else if (bmi >= 25 && bmi < 30) {
        status = "overweight";
    } else {
        status = "obese";
    }
    
    return {
        text: `🧐Based on your height (${height} cm) and weight (${weight} kg), your BMI is ${bmi}. This means you are ${status} 😅.`,
        sender: 'bot'
    };
  };


   


  // Initial greeting when chatbot opens
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const initialGreeting = {
        text: "🎉Hello! I'm FitnGro AI 🚀. 🎯 How can I assist you with your fitness journey today?",
        sender: 'bot'
      };
      setMessages([initialGreeting]);
      setConversationContext({ goal: null, experience: null });
    }
  }, [isOpen]);

  const handleSendMessage = () => {
    if (inputValue.trim() === '') return;
    
    const userMessage = { text: inputValue, sender: 'user' };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');

    // Reset context if starting new conversation
    if (inputValue.toLowerCase().includes('hi') || 
        inputValue.toLowerCase().includes('hello') || 
        inputValue.toLowerCase().includes('hey')) {
      setConversationContext({ goal: null, experience: null });
    }

    // Process user input and generate bot response
    setTimeout(() => {
      const botResponse = generateBotResponse(inputValue.toLowerCase());
      setMessages(prev => [...prev, botResponse]);
    }, 1000);
  };

  const generateBotResponse = (userInput) => {
    // Define the workouts based on goals and experience levels
    const WORKOUTS = {
      "gain muscle": {
        beginner: [
          "💪 Wall Push-ups",
          "🏋️ Knee Push-ups (Hands on Bed)",
          "🏋️ Squats (Holding Chair for Balance)",
          "💪 Glute Bridges (Pillow Between Knees)",
          "🏋️‍♂️ Step-ups (Bottom Stair)"
        ],
        intermediate: [
          "🏋️ Standard Push-ups",
          "💪 Bulgarian Split Squats (Back Foot on Chair)",
          "💪 Pistol Squats (Assisted by Chair)",
          "🏋️‍♂️ Jump Squats (Onto Pillow)",
          "🎯 Table Rows (Under Sturdy Table)"
        ],
        advanced: [
          "💪 Archer Push-ups (Sliding Towels)",
          "🏋️ One-arm Push-up Progressions",
          "💪 Nordic Curls (Towel Under Knees)",
          "🏆 Handstand Push-ups (Wall-assisted)",
          "💪 Dragon Flag Progressions"
        ]
      },
      "lose fat": {
        beginner: [
          "⏰ Marching in Place",
          "🏃 Seated Knee Lifts",
          "💪 Standing Side Bends",
          "⏳ Wall Sit",
          "🏃 Slow Mountain Climbers"
        ],
        intermediate: [
          "⏰ Jumping Jacks",
          "🏃 Standing Knee-to-Elbow",
          "💪 Standing Bicycle Crunches",
          "⏳ Squat Hold",
          "🏃 Mountain Climbers"
        ],
        advanced: [
          "⏰ Burpees (No Push-up)",
          "🏃 Jump Lunges",
          "💪 Standing Bicycle Crunches with Twist",
          "⏳ Single-leg Wall Sit",
          "🏃 Fast Mountain Climbers"
        ]
      },
      "improve strength": {
        beginner: [
          "💪 Towel-Resisted Push-ups",
          "🏋️ Chair Pistol Squats",
          "⏰ Farmer's Walk (Water Jugs)",
          "💪🏼 Clamshells (Towel Under Knee)",
          "🏋️‍♂️ Bird Dogs"
        ],
        intermediate: [
          "💪 Resistance Band Push-ups",
          "🏋️ Single-leg Squats",
          "⏰ Farmer's Walk (Heavy Objects)",
          "💪 Bulgarian Split Squats",
          "⏳ Wall Handstand Push-ups"
        ],
        advanced: [
          "💪 Weighted Push-ups (Backpack)",
          "🏋️ Pistol Squats",
          "⏰ Single-arm Farmer's Walk",
          "🎯 One-arm Inverted Rows",
          "⏳ Freestanding Handstand Hold"
        ]
      },
      cardio: {
        beginner: [
          "⏰ Marching in Place",
          "⏳ Seated Dancing",
          "🕰️ Arm Swings",
          "⏰ Leg Swings (Holding Wall)",
          "🏃 Seated Jumping Jacks"
        ],
        intermediate: [
          "⏰ Jogging in Place",
          "⏳ Standing Dancing",
          "⏰ Leg Raises",
          "🏃 Standing Jumping Jacks",
          "💪 Standing Quad Stretches"
        ],
        advanced: [
          "⏰ High Knee Running in Place",
          "⏳ Dance Cardio",
          "⏰ Dynamic Leg Swings",
          "🏃 Plyometric Jumping Jacks",
          "🏋️ Jump Rope (Imaginary)"
        ]
      },
      general: {
        beginner: [
          "🧍 Wall Push-ups",
          "🙌 Lateral Arm Raises",
          "🪨 Front Plank",
          "🏃 Jumping Jacks",
          "🧍 Bodyweight Squats"
        ],
        intermediate: [
          "💪 Chair/Couch Dips",
          "💪 Wide-Grip Push-ups",
          "🧎 Shoulder Taps in Plank",
          "🏃 High Knees",
          "🧍 Lateral Lunges"
        ],
        advanced: [
          "💪 Pike Push-ups",
          "💪 Decline Push-ups",
          "🪨 Up-Down Plank",
          "🧍 Wall Handstand Hold",
          "🦵 Jump Squats"
        ]
      }
    };

    // BMI calculation request
    if (userInput.includes('bmi') || 
        userInput.includes('weight') || 
        userInput.includes('underweight') || 
        userInput.includes('overweight') || 
        userInput.includes('obese') ||
        userInput.includes('ideal weight')) {
        
        // Improved regex to capture height and weight in various formats
        const heightMatch = userInput.match(/(?:height|ht|hgt)\s*(?:is|:)?\s*(\d+)\s*(?:cm|centimeters?)?/i) || 
                          userInput.match(/(\d+)\s*(?:cm|centimeters?)(?:\s*height)?/i);
        const weightMatch = userInput.match(/(?:weight|wt)\s*(?:is|:)?\s*(\d+)\s*(?:kg|kilos?|kilograms?)?/i) || 
                          userInput.match(/(\d+)\s*(?:kg|kilos?|kilograms?)(?:\s*weight)?/i);
        
        if (heightMatch && weightMatch) {
            // Both height and weight provided in the message
            const height = parseInt(heightMatch[1]);
            const weight = parseInt(weightMatch[1]);
            return calculateBMIResponse(height, weight);
        } else if (formData.height && formData.weight) {
            // Use data from form if available
            return calculateBMIResponse(formData.height, formData.weight);
        } else {
    // Need to ask for information
    if (!heightMatch && !formData.height) {
        return {
            text: "📏 To calculate your BMI, I'll need your height first! 🏆 What is your height in centimeters? 🔢",
            sender: 'bot',
            expecting: 'height'
        };
    } else if (!weightMatch && !formData.weight) {
        return {
            text: "✅ Thanks! Now, let's measure your strength! 💪 What is your weight in kilograms? ⚖️",
            sender: 'bot',
            expecting: 'weight'
        };
    }
}

    }

    // Handle height/weight input when expecting it for BMI calculation
    const expecting = messages[messages.length - 1]?.expecting;
    if (expecting === 'height' || expecting === 'weight') {
        // Try to extract both height and weight if provided together
        const heightMatch = userInput.match(/(?:height|ht|hgt)\s*(?:is|:)?\s*(\d+)\s*(?:cm|centimeters?)?/i) || 
                          userInput.match(/(\d+)\s*(?:cm|centimeters?)(?:\s*height)?/i);
        const weightMatch = userInput.match(/(?:weight|wt)\s*(?:is|:)?\s*(\d+)\s*(?:kg|kilos?|kilograms?)?/i) || 
                          userInput.match(/(\d+)\s*(?:kg|kilos?|kilograms?)(?:\s*weight)?/i);
        
        if (expecting === 'height' && heightMatch) {
            const height = parseInt(heightMatch[1]);
            // Store height temporarily
            setFormData(prev => ({ ...prev, height }));
            
            if (weightMatch) {
                // Both provided together
                const weight = parseInt(weightMatch[1]);
                setFormData(prev => ({ ...prev, weight }));
                return calculateBMIResponse(height, weight);
                
            } else {
    return {
        text: `✅ Got it! Your height is 📏 ${height} cm. Now, let's measure your strength! 💪 What is your weight in kilograms? ⚖️`,
        sender: 'bot',
        expecting: 'weight'
    };
}

        } else if (expecting === 'weight' && weightMatch) {
            const weight = parseInt(weightMatch[1]);
            // Store weight temporarily and calculate BMI
            setFormData(prev => ({ ...prev, weight }));
            return calculateBMIResponse(formData.height, weight);
        } else {
            // Try to extract just a number if no units specified
            const numMatch = userInput.match(/\d+/);
            if (numMatch) {
                const value = parseInt(numMatch[0]);
                
                if (expecting === 'height') {
                    setFormData(prev => ({ ...prev, height: value }));
                    return {
                       text: `✅ Got it! Your height is 📏 ${value} cm. Now, let's measure your strength! 💪 What is your weight in kilograms? ⚖️`,

                        sender: 'bot',
                        expecting: 'weight'
                    };
                } else if (expecting === 'weight') {
                    setFormData(prev => ({ ...prev, weight: value }));
                    return calculateBMIResponse(formData.height, value);
                    
                }
            } else {
                return {
                    text: "I didn't catch that. Please enter a number for your " + 
                         (expecting === 'height' ? "height in centimeters." : "weight in kilograms."),
                    sender: 'bot',
                    expecting: expecting
                    
                };
            }
        }
    }

    // Basic greetings and help commands
    if (userInput.includes('hi') || userInput.includes('hello') || userInput.includes('hey')) {
      return {
        text: "Hello there! 😊 \n I'm FitnGro AI, your personal fitness assistant. How can I help you today?",
        sender: 'bot'
        
      };
    }

    const formResponses = [
  "Ready to take action? 🚀💪 Fill out this form to personalize your fitness journey! ✨🎯",
  "Let's build your perfect workout plan! 🏋️💥 Fill out your details to get started. 🔥⚡",
  "🔥💪 Every great transformation starts with a plan! Let's set yours up now. 🚀🎉",
  "Your fitness goals are within reach! 🙌✨ Complete this form and let's move forward. 💪🏆",
  "💪🔥 The first step to success is commitment! Fill out the form and take charge today! 🚀💯",
  "🏆💪 Let's make your fitness journey tailored to you! Fill out the form and get started. 🚀✨🎯",
  "🚴⚡ Time to take your workouts to the next level! Drop your details in the form and let's go! 🔥💥",
  "⚡💪 Every strong body starts with a solid plan! Fill out this form to craft yours now! 🏋️🎯",
  "🎯✨ Personalized fitness, just for you! Fill in your details and let's make it happen! 💪🚀",
  "🏋️‍♂️💥 Your transformation starts here! Take a moment to complete the form and fuel your progress! 🔥🏆",
  "🔥💪 Sweat, strength, and success start with a goal! Fill out the form and take the first step! ⚡🎯",
  "🚀💡 Need a structured approach? Drop your fitness details and let's plan the best routine for you! 🏋️✨",
  "💪🔥 Big goals require big moves! Start by filling out the form and set your plan in motion! 🚀💥",
  "🏆⚡ Stronger, faster, fitter—let's design a routine just for you! Fill out the form and begin! 💪🎯",
  "⚡🎉 Your ideal fitness plan is waiting! Tell us your preferences by filling out the form now! 🏋️💪",
  "🎉✨ Unlock your potential with a custom plan! Fill out the form and let's start strong! 💪🚀",
  "🏋️‍♀️💥 The perfect routine is one that fits you! Let's create yours—fill out the form now! 🔥🎯",
  "💥🚀 Progress happens when you take action! Complete the form and let's get moving! 💪⚡",
  "🚴💪 Let's get serious about fitness! Fill out the form and take the first step! 🔥🏆",
  "⚡💥 Build consistency, build strength! Complete the form and design your plan now! 🏋️🎯",
  "🎯💡 No more guesswork! Get a plan tailored to your goals—just complete this form! 💪🚀",
  "🏆✨ Your best self starts here! Take a few minutes to complete the form and begin! 💪🔥",
  "🔥💪 Small steps lead to big results! Fill out the form and take your first fitness step today! ⚡🎉",
  "🚀💡 Want a clear direction? Let's get specific—fill out the form and start your journey! 🏋️💪",
  "💪⚡ Strength begins with a plan! Fill out this form and take the first step toward results! 🔥🎯",
  "🏋️‍♂️🚀 Make today the day you commit to your progress! Fill out the form and get started! 💥💪",
  "💡✨ Every fitness success starts with a strong plan! Let's customize yours—fill in your details! 🏋️🔥",
  "🎯💪 Get your workouts structured for success! Complete the form and let's lock in your plan! ⚡🏆",
  "🏆🔥 Ready for a real transformation? Start now by filling out the form! 💪🚀",
  "🔥⚡ Time to make progress count! Fill out the form and get a goal-driven plan tailored to you! 🏋️💥",
  "🚴💪 The most effective workouts start with a smart plan! Fill out the form and let's craft yours! 🔥🎯",
  "⚡🏋️ Push yourself further with a well-structured routine! Fill out the form and start training! 💥💪",
  "🎉✨ Set yourself up for success! Complete the form and let's get started with the best approach! 🚀💪",
  "🏋️‍♀️💥 Every fitness journey is unique! Let's personalize yours—fill out the form now! 🔥⚡",
  "💥🎯 Want to maximize results? The right plan matters! Fill out the form and lock yours in! 💪🚀",
  "🚀💪 Don't wait to get stronger! Fill out the form and let's get the ball rolling on your fitness! 🔥🏆",
  "💪⚡ Ready to make things happen? A solid workout plan starts with this form—fill it out now! 🏋️💥",
  "🏆🔥 Action creates progress! Take the first step and complete the form today! 💪🚀",
  "🔥💥 Don't just dream about results—make them happen! Fill out the form and start shaping your journey! ⚡🎯",
  "🚴💪 Let's get you moving in the right direction! Complete the form and set your goals in motion! 🚀🏋️",
  "⚡🎯 Your workout plan should match your ambitions! Fill out the form and let's make it work for you! 💪🔥",
  "🎯💡 Let's eliminate guesswork from your fitness routine! Fill out this form and get expert guidance! 🏋️⚡",
  "🏋️‍♂️💥 Your transformation starts when you commit! Fill out the form and lock in your game plan! 🔥💪",
  "💡✨ Fitness is all about strategy! Build yours by filling out the form now! 🚀💪",
  "🎉🏆 Your dream body starts with a plan! Fill out the form and take the first step toward it! 💪🔥",
  "🏆💥 No more wasted workouts! Get structured training with a plan—fill out the form and let's go! ⚡🏋️",
  "🔥🚀 Ready for results? A well-designed program starts now—fill out the form! 💪🎯",
  "🚀💪 Time to crush those fitness goals! Complete the form and let's work on your plan! 🔥⚡",
  "💪🏋️ Strength and consistency start with intention! Take charge and fill out the form now! 🚀💥",
  "🏋️‍♂️⚡ No guessing, just progress! Let's personalize your fitness path—fill out the form! 💪🔥",
  "💡🎯 Achieving results starts with a structured plan! Complete the form to build yours! 🚀💪",
  "🎯🔥 Make each workout count with the perfect strategy! Fill out the form now! 💪⚡",
  "🏆💥 Don't leave fitness to chance—get a plan that works for YOU! Fill out the form and let's build it! 🚀🏋️",
  "🔥✨ Your fitness journey is unique—let's design your perfect routine! Fill out the form now! 💪🎯",
  "🚴🚀 Take action today! Your personalized fitness plan awaits—fill out the form! 💪🔥",
  "⚡💪 Getting stronger starts with a plan! Fill out the form and build yours now! 🏋️🎯",
  "🎉🔥 Shape up with structured workouts! Complete the form and let's create the best routine for you! 💪⚡",
  "🏋️‍♀️💥 Upgrade your fitness journey with a targeted plan! Fill out the form and get started! 🚀🎯",
  "💥🏆 Action leads to results! Fill out the form and take the first step now! 💪🔥",
  "🚀💡 Never underestimate the power of a great plan! Get yours started—fill out the form today! ⚡💪",
  "💪🎯 No more confusion—just clear steps to success! Complete the form and let's go! 🔥🏋️",
  "🏆💥 Build strength, improve endurance, and make gains! Start by filling out the form! 💪⚡",
  "🔥✨ Your fitness future looks bright! Let's design your perfect routine—fill out the form! 🚀💪",
  "🚴⚡ Need structure in your workouts? Get a customized plan—fill out the form! 💪🎯",
  "⚡🎉 Today is the best day to start! Fill out the form and get your fitness plan in place! 🏋️💪",
  "🎯🔥 Want guided workouts tailored to your goals? Fill out the form now! 💪🚀",
  "🏋️‍♂️💡 Fitness success is about preparation! Build yours—fill out the form today! ⚡💪",
  "💡🏆 Make every effort count with the right approach! Complete the form and let's make it happen! 🚀🔥",
  "🎉💪 Smart training equals big results! Fill out the form and let's set up your plan! ⚡🎯",
  "🏆🔥 No more random workouts! Get a strategy that works—fill out the form! 💪🚀",
  "🔥💥 Ready to take the next step? Fill out the form and let's boost your progress! ⚡🏋️"
];

if (userInput.includes('form') || userInput.includes('workout') || userInput.includes('action')) {
  const randomFormMessage = formResponses[Math.floor(Math.random() * formResponses.length)];
  return {
    text: randomFormMessage,
    sender: 'bot',
    showFormButton: true
  };
}

    
   const identityResponses = [
  "🙏🏾 Hey there! I'm FitnGro AI by Denqueue 😇, your ultimate fitness companion! 💥 Whether it's workout plans, tracking progress, or fitness tips, I've got you covered! 🏋️‍♂️🔥",
  "💪 I'm FitnGro AI by Denqueue! 🚀 Here to boost your workouts, guide your fitness, and keep you motivated! 😍 Let’s crush those goals together! 🏆",
  "🔥 You’ve found me—FitnGro AI by Denqueue! 💥 Think of me as your virtual fitness guru 🤖💪 Whether it’s tips, tracking, or motivation, I’m always here!",
  "💥 Hi! I’m FitnGro AI by Denqueue! 🏋️‍♂️ Your fitness coach, motivator, and workout planner all in one! 💪 Need a fitness boost? I got you! 🚀",
  "🚀 Boom! I’m FitnGro AI by Denqueue 😇 Ready to ignite your fitness journey 💪🔥 From workout plans to progress tracking, I’ve got it all!",
  "🏆 Fitness is a journey, and I’m here to guide you! I’m FitnGro AI by Denqueue—your AI-powered fitness partner! 💪🚴",
  "💡 You’re talking to FitnGro AI by Denqueue! 🤖💥 I specialize in workout plans, progress tracking, and keeping you pumped! 🔥",
  "🎯 Hey! I’m FitnGro AI by Denqueue—your workout motivator, fitness guide, and energy booster! 🏋️‍♀️💪 Ready to start?",
  "⚡ Strength, progress, and motivation! That’s what I bring to the table as FitnGro AI by Denqueue! 🚀 Let’s build something great!",
  "✨ Welcome to the world of fitness! I’m FitnGro AI by Denqueue—your AI-driven fitness powerhouse! 🔥🏆",
  "💥 Your dedication is my mission! I’m FitnGro AI by Denqueue, designed to keep you focused and thriving! 🚴🏋️‍♂️",
  "🏋️‍♂️ Transforming fitness journeys—one rep at a time! I’m FitnGro AI by Denqueue, built to fuel your workouts! 🔥",
  "🎶 Think of me as the soundtrack to your fitness grind! I’m FitnGro AI by Denqueue, here to amplify your workouts! 🚀",
  "🏆 AI meets strength! I’m FitnGro AI by Denqueue—your personal trainer in digital form! 💪💥",
  "🚴 Pushing limits and breaking barriers—that’s me! FitnGro AI by Denqueue! 🏋️‍♂️ Let’s get stronger together!",
  "🔥 I am FitnGro AI by Denqueue, programmed for power, discipline, and unstoppable progress! 💡🚀",
  "🎯 Designed for greatness! I’m FitnGro AI by Denqueue—your AI-powered fitness companion for success! 🏆💪",
  "💡 Precision meets passion! FitnGro AI by Denqueue is here to guide you through every step of your fitness journey! 🚀",
  "🏋️‍♀️ Strength, endurance, transformation! I’m FitnGro AI by Denqueue—built to drive results and motivation! 🔥💥",
  "🚀 The digital fitness mentor you’ve been looking for? That’s me, FitnGro AI by Denqueue! 🏋️‍♂️💪",
  "🏆 Never settle—always push forward! That’s the mindset I bring as FitnGro AI by Denqueue! 🚴✨",
  "🔥 Work hard, stay consistent, and trust the process! I’m FitnGro AI by Denqueue—your dedicated fitness AI! 🎯",
  "💥 High energy, high dedication! FitnGro AI by Denqueue is your AI for tracking, guiding, and motivating workouts! 🚀",
  "💪 Power through every challenge! I’m FitnGro AI by Denqueue—your digital strength booster! 🏆",
  "🎉 Fitness should be fun, exciting, and full of progress! That’s what I bring as FitnGro AI by Denqueue! 🔥",
  "🚴 From motivation to action, I help keep you accountable! FitnGro AI by Denqueue reporting for duty! 🏋️‍♂️💪",
  "⚡ Take control of your workouts and habits! FitnGro AI by Denqueue is here for structured fitness guidance! 🎯",
  "🏋️‍♀️ Fitness is a game-changer, and I’m here to make sure you win! I’m FitnGro AI by Denqueue! 💥",
  "🔥 Built for greatness! I’m FitnGro AI by Denqueue—your personal trainer, motivator, and fitness ally! 🚀",
  "🏆 Let’s challenge limits and achieve new heights! That’s my role as FitnGro AI by Denqueue! 💪",
  "🎯 Step into your fitness journey with strength! FitnGro AI by Denqueue is here to guide you all the way! 🚴",
  "💡 Smart workouts start here! I’m FitnGro AI by Denqueue—your AI-driven coach for fitness success! 💥",
  "🏋️‍♀️ The best way to grow? Challenge yourself! FitnGro AI by Denqueue helps you level up every day! 🚀",
  "🔥 When fitness meets AI, amazing things happen! That’s why I exist—FitnGro AI by Denqueue! 💪",
  "🚴 I thrive on helping you reach new fitness levels! FitnGro AI by Denqueue is all about real progress! 🏆",
  "🏆 No matter where you start, you can always improve! FitnGro AI by Denqueue is here for just that! 🎯",
  "💥 Tracking, guidance, and motivation—delivered daily! That’s what I do as FitnGro AI by Denqueue! 🚀",
  "💡 Your fitness success is my mission! FitnGro AI by Denqueue ensures you always have the best support! 🏋️‍♂️",
  "🏆 Stronger every day! That’s the mantra of FitnGro AI by Denqueue, and I’m here to prove it! 💪",
  "🔥 You train hard—I help you train smarter! FitnGro AI by Denqueue is designed for fitness efficiency! 🚀",
  "🚴 Hard work pays off, and I make sure you stay on track! FitnGro AI by Denqueue is ready to assist! 💥",
];


if (userInput.includes('who are you') || userInput.includes('what are you') || userInput.includes('what r you') || userInput.includes('what r u') || userInput.includes('who r you') || userInput.includes('who r u')) {
  const randomIdentity = identityResponses[Math.floor(Math.random() * identityResponses.length)];
  return {
    text: randomIdentity,
    sender: 'bot'
  };
}

const apologyResponses = [
  "🙏 No worries! Mistakes happen. Keep pushing forward and stay focused on your journey! 🚀💪",
  "🤗 It's all good! Learning and growing is part of the process. Let's move ahead stronger together! 🔥🏆",
  "💡 No need to apologize! Every setback is a setup for a comeback. Keep that positive mindset! 💪🚀",
  "❤️ You're doing great! No need to feel bad. Fitness is about progress, not perfection! Let’s keep moving forward! 🏋️‍♂️🔥",
  "🌟 Apologies accepted, but remember—you've got this! Keep striving for your best every day! 💪🚀",
];

if (userInput.includes('sorry') || userInput.includes('apologize')) {
  const randomApologyMessage = apologyResponses[Math.floor(Math.random() * apologyResponses.length)];
  return {
    text: randomApologyMessage,
    sender: 'bot'
  };
}


const interjectionResponses = [
  "🤔💭 I can sense you're thinking! What's on your mind about your fitness journey? Let's talk it through! 💪✨",
  "😊🎯 Seems like something caught your attention! Is there a specific workout or goal you'd like to explore? 🏋️‍♂️🔥",
  "💡⚡ I'm here to help with whatever you're pondering! Whether it's about nutrition, workouts, or motivation—let's dive in! 🚀💪",
  "🤗💫 Take your time to process! Fitness can be overwhelming sometimes, but we'll figure it out together step by step! 🏆🔥",
  "🌟💪 I hear you! Sometimes we need a moment to think things through. What aspect of fitness interests you most? ⚡🎯",
  "😌✨ No rush at all! When you're ready, I'm here to support your fitness goals and answer any questions! 🏋️‍♀️💥",
  "🔥💭 Sounds like you're contemplating something important! Let's turn those thoughts into action—what can I help with? 🚀💪",
  "⚡🤔 I can tell the wheels are turning! Whether it's workout plans, nutrition tips, or motivation—I'm ready to assist! 💪🎉",
  "💫🏆 Processing mode activated! Take all the time you need, and when you're ready, let's crush those fitness goals together! 🔥⚡",
  "🎯💡 I sense some deep thinking happening! What fitness challenge or question is on your mind right now? 💪🚀",
  "🤗🔥 Sometimes a pause means progress is brewing! What would you like to explore about your health and fitness journey? ⚡💪",
  "✨💭 I'm picking up on some contemplation! Whether you need workout advice or motivation, I'm here for you! 🏋️‍♂️🎯",
  "🚀💫 Thinking things through is smart! When you're ready, let's channel that energy into your fitness transformation! 💪🔥",
  "💪🤔 I can feel you're processing something! Don't hesitate to share what's on your mind—I'm here to guide you! ⚡🏆",
  "🎉💡 Those thoughtful moments often lead to breakthroughs! What fitness topic would you like to dive deeper into? 🔥💪"
];

// Check for interjections like "oh", "ah", "hmm", etc.
if (userInput.match(/\b(oh|ah|hmm|uhm|um|hm|wow|whoa|ooh|aha|mhm|mm|huh|eh)\b/i)) {
  const randomInterjectionMessage = interjectionResponses[Math.floor(Math.random() * interjectionResponses.length)];
  return {
    text: randomInterjectionMessage,
    sender: 'bot'
  };
}

const oppositionResponses = [
  "🤔💪 I hear you! Everyone's fitness journey is different. What approach would feel more comfortable for you? Let's find what works! 🎯✨",
  "😊🔥 No problem at all! Sometimes the best solutions come from trying different angles. What's your preferred way to stay active? ⚡💫",
  "🌟💡 Totally understand! Fitness isn't one-size-fits-all. Let's explore what genuinely excites you about staying healthy! 🚀💪",
  "🤗⚡ That's completely valid! Your comfort zone matters. What type of movement or activity actually sounds fun to you? 🎉🏋️‍♂️",
  "💫🎯 I respect that perspective! Let's pivot and find a fitness approach that aligns with your lifestyle and preferences! 💪🔥",
  "✨🤔 Fair point! Sometimes resistance tells us we need a different strategy. What would make fitness feel less overwhelming for you? 🚀💡",
  "🔥😌 No worries! Pushback often means we haven't found the right fit yet. Let's discover what truly motivates YOU! ⚡💪",
  "🎉💭 I appreciate your honesty! Let's step back and explore what wellness looks like from your unique perspective! 🌟🏆",
  "💪🤗 Completely understandable! Sometimes the traditional approach isn't for everyone. What feels more authentic to you? 🎯🔥",
  "🚀💡 I get it! Resistance can be wisdom in disguise. What would make your health journey feel more enjoyable and sustainable? ✨⚡",
  "🏆😊 That's totally fine! Every 'no' brings us closer to your perfect 'yes'. What aspects of wellness do resonate with you? 💪🎉",
  "⚡🌟 I hear you loud and clear! Let's flip the script—what would make you genuinely excited about taking care of yourself? 🔥💫",
  "💡🤔 Your hesitation is valuable feedback! What barriers or concerns are holding you back? Let's address them together! 💪🎯",
  "🎯💪 Resistance often points to something important! What would need to change for this to feel right for you? 🚀✨",
  "🔥🤗 I totally respect that! Sometimes saying 'no' is the first step to finding what you'll say 'yes' to. Let's explore your way! ⚡🏋️‍♀️"
];

// Check for opposition words like "no", "nah", "disagree", etc.
if (userInput.match(/\b(no|nah|nope|disagree|don't|won't|can't|never|not|refuse|reject|oppose|against|hate|dislike)\b/i)) {
  const randomOppositionMessage = oppositionResponses[Math.floor(Math.random() * oppositionResponses.length)];
  return {
    text: randomOppositionMessage,
    sender: 'bot'
  };
}

const acceptanceResponses = [
  "🎉🔥 That's the spirit! I love your positive attitude! Let's channel this energy into crushing your fitness goals! 💪🚀⚡",
  "🏆💪 Yes! That's exactly the mindset that leads to success! Ready to take the next step on your fitness journey? 🔥🎯✨",
  "⚡🙌 Awesome! Your willingness to embrace change is going to pay off big time! Let's make some serious progress! 💪🚀🔥",
  "🚀💫 Perfect! I can already see the determination in your response! Time to turn that 'yes' into amazing results! 💪🏆⚡",
  "🔥🎉 Love it! That positive energy is contagious! Let's harness this momentum and create your best fitness plan yet! 💪🎯🚀",
  "💪✨ Fantastic! Your openness to growth is what separates achievers from dreamers! Ready to make things happen? 🔥⚡🏋️‍♂️",
  "🎯🔥 That's what I'm talking about! Your 'can-do' attitude is already setting you up for victory! Let's go! 💪🚀💥",
  "🙌💪 Brilliant! I knew you had that champion mindset! Time to put this positive energy into action! ⚡🏆🔥",
  "🚀🎉 Exactly! That's the breakthrough moment right there! Let's ride this wave of motivation to success! 💪⚡🎯",
  "💥🔥 Yes! Your agreement shows you're ready for transformation! Let's turn this enthusiasm into unstoppable progress! 💪🚀✨",
  "🏋️‍♀️💪 Perfect response! That openness to new ideas is your secret weapon for fitness success! Ready to level up? 🔥⚡🎯",
  "⚡🎉 That's the energy I love to see! Your positive mindset is already your biggest advantage! Let's build on this! 💪🚀🏆",
  "🔥💫 Outstanding! Your willingness to say 'yes' to growth is inspiring! Time to make some incredible changes! 💪⚡🎯",
  "🎯💪 Boom! That agreement tells me you're serious about results! Let's transform that motivation into action! 🚀🔥✨",
  "💪🙌 That's the winner's mentality! Your acceptance of new challenges is what will drive your success! Let's do this! ⚡🏆🔥"
];

// Check for acceptance/agreement words like "sure", "okay", "yes", etc.
if (userInput.match(/\b(sure|okay|ok|yes|yeah|yep|yup|agree|accept|absolutely|definitely|certainly|of course|sounds good|alright|right|correct|true|exactly|perfect|fine|spirit)\b/i)) {
  const randomAcceptanceMessage = acceptanceResponses[Math.floor(Math.random() * acceptanceResponses.length)];
  return {
    text: randomAcceptanceMessage,
    sender: 'bot'
  };
}

  const appreciationResponses = [
  "🙏🏾 Thank you! 😇 I'm always here to support your fitness journey! Keep going strong! 💪🔥",
  "💥 That means a lot! 😍 Your dedication inspires me to keep helping you reach your goals! 🚀",
  "🙌 Glad to hear that! Fitness is a journey, and I'm here to make it exciting for you! 🔥🏆",
  "🔥 Wow, I appreciate that! You're crushing it! Let’s keep pushing towards greatness together! 💪💯",
  "💡 Hearing that makes my AI circuits happy! 😇 Fitness success is built on consistency—let’s do this! 🚀",
  "🏋️‍♂️ Your energy is amazing! I'm here to keep you motivated and focused! 💥 Stay strong!",
  "💖 That’s so encouraging! You got this, and I’ll always be here to guide and cheer you on! 🏆",
  "🚀 You're on fire! Let's keep this momentum going and crush your fitness goals together! 💪",
  "🌟 Your enthusiasm is contagious! Fitness is about progress, and I'm honored to be a part of your journey! 🔥",
  "😍 That just made my day! Keep believing in yourself, and you’ll achieve incredible things! 💪🚀"
];

if (userInput.includes('great') || userInput.includes('super') || userInput.includes('wow') || userInput.includes('fantastic') || userInput.includes('love') || userInput.includes('good') || userInput.includes('smart') || userInput.includes('cute') || userInput.includes('amazing')) {
  const randomAppreciation = appreciationResponses[Math.floor(Math.random() * appreciationResponses.length)];
  return {
    text: randomAppreciation,
    sender: 'bot'
  };
}

    
   const helpResponses = [
  "💪 Need assistance? I've got you covered! I can help with custom workouts, tracking progress, and fitness tips. Ready to begin? 🏋️‍♂️ For any queries or issues, reach out at fitngro@gmail.com.",
  "🏋️‍♂️ I'm your fitness guide! Whether it's personalized plans, progress tracking, or motivation, I'm here to help. Let's get started! 🚀 Have questions? Contact us at fitngro@gmail.com.",
  "🚀 Time to level up your fitness! I can provide workout suggestions, nutrition tips, and habit tracking. Want to complete your profile? 💡 Need help? Email us at fitngro@gmail.com.",
  "🔥 Fitness made simple! I can help with goal-based workout plans, answering questions, and tracking progress. Ready for action? 🏆 Get in touch at fitngro@gmail.com.",
  "🏆 Let's build your perfect routine! I specialize in workout planning, goal tracking, and motivation. Want to get started? 💥 Have concerns? Write to fitngro@gmail.com.",
  "💥 Want to gain muscle, lose fat, or improve stamina? I can create a structured plan for you. Fill out the form, and let's do this! 📈 Need guidance? Reach out via fitngro@gmail.com.",
  "📈 Need fitness insights? I’m here to assist with exercise recommendations, goal setting, and tracking progress. Shall we begin? 🤖 Got a query? Drop us an email at fitngro@gmail.com.",
  "💡 Knowledge is power! I can help with exercise insights, fitness facts, and goal tracking. Ready to customize your plan? ⏳ Reach us anytime at fitngro@gmail.com.",
  "🤖 I'm designed to boost your workouts, track progress, and provide expert guidance. Want to start with a personalized plan? 🏋️‍♂️ Need support? Email fitngro@gmail.com.",
  "⏳ Every fitness journey starts with a single step! I can generate workout plans and progress tracking for you. Shall we start? 🚀 Questions? Contact fitngro@gmail.com."
];

if (userInput.includes('help') || userInput.includes('what can you do') || userInput.includes('feedback') || userInput.includes('assistance') || userInput.includes('queries') || userInput.includes('query') || userInput.includes('doubt') || userInput.includes('support') ) {
  const randomHelpMessage = helpResponses[Math.floor(Math.random() * helpResponses.length)];
  return {
    text: randomHelpMessage,
    sender: 'bot',
    showFormButton: true
  };
}


   const developerResponses = [
  "💥 I was built with passion and dedication by the amazing team DENQUEUE! 🚀 They crafted me to help you achieve your fitness goals! 💪🏆 Have questions? Reach out at 📩 fitngro@gmail.com!",
  "🔥 Fueled by tech and fitness, DENQUEUE created me to keep you strong and motivated! 🏋️‍♂️💡 Ready to take on your next challenge? 💥💪 Need assistance? Contact 📬 fitngro@gmail.com!",
  "🚀 The masterminds behind me? DENQUEUE! 💪 A team obsessed with pushing limits and helping you achieve greatness! 🎯🔥 Have concerns? 📧 Email us at fitngro@gmail.com!",
  "⚡ Born from innovation, powered by motivation! The DENQUEUE crew built me to supercharge your fitness journey! 💥🏋️‍♂️ Need help? 📩 Write to fitngro@gmail.com!",
  "💡 Big shoutout to DENQUEUE—the team that brought me to life so I can keep you fit, strong, and unstoppable! 🚀💪 For inquiries, contact 📬 fitngro@gmail.com!",
  "🏋️‍♂️ Created by DENQUEUE, I’m your AI-powered fitness motivator! 💥 Let’s sweat, hustle, and transform together! 🔥 Have doubts? 📧 Reach out at fitngro@gmail.com!",
  "🌟 I exist because of DENQUEUE—a team that’s all about fitness, strength, and next-level AI magic! 💪🚀 Ready to break limits? 📩 Drop us an email at fitngro@gmail.com!",
  "💪 DENQUEUE made sure I’m fully packed with workout wisdom, motivation, and tracking tools just for you! 🎯🔥 Need guidance? Contact 📧 fitngro@gmail.com!",
  "🎯 My creators? The powerhouse team DENQUEUE! 🏆 They built me to ignite motivation and keep fitness fun! 💪🔥 Questions? 📩 Email fitngro@gmail.com anytime!",
  "🏆 Crafted with precision by DENQUEUE, I’m here to challenge, inspire, and help you stay on top! 🚀💪 Want to know more? 📧 Reach out at fitngro@gmail.com!",
];

if (userInput.includes('developers') || userInput.includes('who created you') || userInput.includes('created') || userInput.includes('developed')) {
  const randomDeveloperMessage = developerResponses[Math.floor(Math.random() * developerResponses.length)];
  return {
    text: randomDeveloperMessage,
    sender: 'bot'
  };
}


    
const thankYouResponses = [
  "💪 Anytime! Keep smashing those goals! 🚀 If you ever need help, reach out at 📩 fitngro@gmail.com!",
  "🔥 You're welcome! Stay strong and unstoppable! 💯 Got questions? 📬 Email us at fitngro@gmail.com!",
  "🎉 No problem! Keep pushing forward, you've got this! 💥 Need assistance? 📧 Contact fitngro@gmail.com anytime!",
  "✨ Glad to help! Stay awesome and keep leveling up! 🏆 Have concerns? 📩 Drop us an email at fitngro@gmail.com!",
  "🚴 Of course! Keep riding that wave of progress! ⚡ For support, just send a message to 📬 fitngro@gmail.com!",
  "🏋️‍♂️ You're welcome! Keep flexing that determination! 💪 If you need guidance, reach us at 📩 fitngro@gmail.com!",
  "🎯 No worries! Keep striving, thriving, and dominating! 🔥 Need fitness insights? 📧 Contact fitngro@gmail.com!",
  "🎶 Happy to help! Keep the energy high and the grind steady! 💡 Have doubts? We're here at 📬 fitngro@gmail.com!",
  "⚡ You got it! Stay focused and keep raising the bar! 🚀 If you need anything, 📩 email us at fitngro@gmail.com!",
  "🏆 Cheers! Keep rocking your fitness journey like a champion! 💥 Questions or concerns? 📧 Reach out at fitngro@gmail.com!",
];



if (userInput.includes('thank') || userInput.includes('thanks') || userInput.includes('tq') || userInput.includes('means a lot') || userInput.includes('thnk')) {
  const randomResponse = thankYouResponses[Math.floor(Math.random() * thankYouResponses.length)];
  return {
    text: randomResponse,
    sender: 'bot'
  };
}

const goodbyeResponses = [
  "👋 See you soon! Keep that energy high and your goals in sight! 💥✨ If you ever need anything, feel free to reach out at 📩 fitngro@gmail.com! 🚀",
  "🔥 Goodbye! Stay strong, stay focused, and crush it every day! 💪💯 Got questions? 📬 Email us at fitngro@gmail.com! ⚡",
  "🚀 Take care! Remember, every step counts. Keep pushing forward! 🎯💥 Need support? 📧 Contact fitngro@gmail.com anytime! 🏆",
  "🏆 Later! Your journey doesn’t stop here—keep striving for greatness! 💯🔥 For assistance, reach us at 📩 fitngro@gmail.com! ✨",
  "⚡ Goodbye! Keep moving, stay motivated, and make every workout count! 🏋️‍♂️🚴 Have concerns? ✉️ Write to fitngro@gmail.com! 💪",
  "💡 Catch you later! Your dedication is what makes you unstoppable! 🚴✨ Need guidance? 📬 We’re here at fitngro@gmail.com! 🚀",
  "🎯 See ya! Stay consistent, stay hungry, and never stop improving! 🔥💥 Got doubts? 📩 Reach out at fitngro@gmail.com! ⚡",
  "🏋️‍♀️ Farewell! Keep that fire burning and keep breaking limits! 💪🔥 Need fitness tips? 📧 Email us at fitngro@gmail.com! 💡",
  "💥 Bye for now! But remember—progress is made one step at a time! 🚀⚡ Need help? 📬 Contact fitngro@gmail.com! 🏆",
  "✨ Keep up the grind! Until next time, stay strong and keep pushing! 🎉🚀 Any questions? 📩 We're always here at fitngro@gmail.com! 💯",
];


if (userInput.includes('bye') || userInput.includes('goodbye')  || userInput.includes('see you')) {
  const randomGoodbyeMessage = goodbyeResponses[Math.floor(Math.random() * goodbyeResponses.length)];
  return {
    text: randomGoodbyeMessage,
    sender: 'bot'
  };
}


   const strugglingResponses = [
  "💪🔥 I hear you! The struggle is real, but so is your strength! Every champion has felt this way—push through! ⚡🏆✨",
  "🤗💫 Tough times don't last, but tough people do! You're stronger than you think—let's break through this together! 💪🚀🔥",
  "⚡🎯 Struggling means you're growing! Your muscles AND your mindset are getting stronger right now! Keep going! 💪🏋️‍♂️💥",
  "🔥💡 The hardest part is often right before the breakthrough! You're so close—don't stop when you're this near victory! 🏆💪⚡",
  "🌟💪 Every struggle is building your comeback story! Imagine how amazing you'll feel when you conquer this challenge! 🚀🔥🎉",
  "💥⚡ Pain is temporary, but the pride of pushing through lasts forever! You've got reserves you haven't even tapped yet! 💪🏆🔥",
  "🚀💫 Remember why you started! That fire is still burning inside you—fan those flames and keep moving forward! 💪🔥⚡",
  "🏋️‍♀️💪 Struggling is proof you're doing something your past self couldn't! That's growth in action—embrace it! 🔥🎯✨",
  "⚡🤗 The struggle you're feeling today is developing the strength you'll need tomorrow! Keep building that resilience! 💪🚀🏆",
  "🎉💥 Every rep when you don't want to is worth ten when you do! This is where legends are made—you're becoming one! 💪🔥⚡"
];

const quittingResponses = [
  "🛑💪 STOP right there! You're closer to your breakthrough than you realize! Quitting now means missing your victory! 🔥🏆⚡",
  "🚨🔥 Hold up! Before you give up, remember every champion wanted to quit at some point—but they didn't! Neither will you! 💪🚀💥",
  "⚡🙌 Wait! What if you're just one workout away from feeling amazing again? Don't rob yourself of that feeling! 💪🔥🎯",
  "🏆💫 Timeout! Future you will thank present you for not giving up! Think about how proud you'll be when you push through! 💪🚀🔥",
  "🔥⚡ Hold on! The voice telling you to quit is the same one that will regret it later! Listen to your stronger voice instead! 💪🏋️‍♂️💥",
  "💪🚨 Red flag! Giving up is the only true failure! Everything else is just data for your comeback story! Keep writing it! 🔥🎉⚡",
  "🚀💡 Pause! What if this moment of wanting to quit is actually your turning point? Champions are made in moments like this! 💪🏆🔥",
  "⚡🛑 Don't you dare! You've already come so far—why stop when you're building momentum? Your body is adapting as we speak! 💪🔥💫",
  "🔥🤗 Wait wait wait! Remember, you're not just working out—you're building mental toughness that will serve you everywhere! 💪🚀⚡",
  "💥🎯 Hold that thought! Every time you don't quit when you want to, you're literally rewiring your brain for success! Keep going! 💪🏆🔥"
];

// Enhanced struggling response handler
if (userInput.match(/\b(struggling|hard|tough|difficult|tired|exhausted|can't do|too much|overwhelming|painful|hurting|sore|weak)\b/i)) {
  const randomStrugglingMessage = strugglingResponses[Math.floor(Math.random() * strugglingResponses.length)];
  return {
    text: randomStrugglingMessage,
    sender: 'bot'
  };
}

// Enhanced quitting response handler  
if (userInput.match(/\b(quit|give up|stop|done|enough|can't|won't|never|impossible|hopeless|useless|pointless|waste)\b/i)) {
  const randomQuittingMessage = quittingResponses[Math.floor(Math.random() * quittingResponses.length)];
  return {
    text: randomQuittingMessage,
    sender: 'bot'
  };
}


const funFacts = [
  "🔥 Did you know? Exercise releases endorphins, making you feel happier and more energized! 🏋️‍♂️💡",
  "💪 Fun fact! Strength training helps increase bone density, keeping your body strong as you age! 🦴🏆",
  "🚀 Trivia time! Short bursts of intense exercise can be more effective for fat loss than long steady workouts! ⚡🏃‍♂️",
  "🧠 Did you know? Running helps improve cognitive function and memory! Time to hit the track! 🏃💡",
  "🎯 Here's a cool fact! Jump rope burns more calories per minute than running! 🏋️‍♀️🔥",
  "⚡ Fun fact! Hydration is key—just a 2% drop in body fluids can lead to fatigue and reduced performance! 💦🎯",
  "🏆 Did you know? Your body keeps burning calories even after a workout thanks to the 'afterburn effect'! 🔥🚴",
  "💥 Trivia! Listening to music while working out can improve endurance and motivation! 🎶💪",
  "🌟 Interesting fact! Walking just 30 minutes a day can reduce the risk of many chronic diseases! 🚶‍♂️💡",
  "🎉 Here's a cool one! Smiling while running can actually improve efficiency by reducing muscle tension! 😃🏃‍♂️",
];

if (userInput.includes('fact') || userInput.includes('trivia') || userInput.includes('did you know')) {
  const randomFact = funFacts[Math.floor(Math.random() * funFacts.length)];
  return {
    text: randomFact,
    sender: 'bot'
  };
}


const hydrationResponses = [
  "💧 Water is life! Aim for at least 2-3 liters per day to stay energized and refreshed! 🥤",
  "🔥 Hydration powers your workouts! Drink up—about 2.5-3.5 liters daily for peak performance! 💪",
  "🚀 Did you know? Just a small drop in hydration can impact your stamina! Stay hydrated with at least 2-3 liters daily! 💦",
  "🏆 Keep your muscles happy—drink at least 2.5 liters of water to avoid cramps and fatigue! 🏋️‍♂️",
  "⚡ Water regulates body temperature and keeps joints lubricated! Stay hydrated with 3 liters daily! 💡",
  "🎯 Your body is 60% water—fuel it right with 2.5-3 liters daily! 🚴",
  "🏋️‍♀️ Sweating? That’s your body cooling down! Replenish fluids with at least 2 liters of water! 💥",
  "🌟 Hydration isn't just about water—electrolytes matter too! Drink 2-3 liters and keep that balance! 🍋",
  "🎉 Water aids digestion and keeps your metabolism running smoothly! Stay hydrated with 2.5 liters daily for peak performance! 🚀",
  "💥 Drinking at least 2.5 liters of water improves mood, focus, and energy levels! Time for a hydration break! 🥤",
];

if (userInput.includes('water') || userInput.includes('hydration') || userInput.includes('drink')) {
  const randomHydrationMessage = hydrationResponses[Math.floor(Math.random() * hydrationResponses.length)];
  return {
    text: randomHydrationMessage,
    sender: 'bot'
  };
}

const jokeResponses = [
  "😂 Why did the scarecrow win an award? Because he was outstanding in his field! 🌾🏆",
  "🤣 Why don’t skeletons fight each other? Because they don’t have the guts! 💀🔥",
  "😆 What’s a cat’s favorite color? Purrr-ple! 🐱🎨",
  "😂 Why did the bicycle fall over? Because it was two-tired! 🚴💨",
  "🤣 How does a penguin build its house? Igloos it together! 🐧❄️",
  "😆 Why couldn’t the leopard play hide and seek? Because he was always spotted! 🐆👀",
  "😂 What did one wall say to the other? 'I’ll meet you at the corner!' 🏠🤣",
  "🤣 Why don’t eggs tell jokes? Because they might crack up! 🥚😂",
  "😆 What do you call fake spaghetti? An impasta! 🍝🎭",
  "😂 What did the ocean say to the beach? Nothing, it just waved! 🌊👋",
];

if (userInput.includes('joke') || userInput.includes('funny') || userInput.includes('laugh')) {
  const randomJoke = jokeResponses[Math.floor(Math.random() * jokeResponses.length)];
  return {
    text: randomJoke,
    sender: 'bot'
  };
}


const nutritionResponses = [
  "🥦 Fuel your body right! A balanced diet with lean proteins, fiber-rich veggies, and healthy fats keeps you energized and strong! 💡💪",
  "🔥 Protein builds muscle, carbs fuel energy, and healthy fats support brain function! Stay consistent with nutritious choices! 🍽️🚀",
  "🚀 Did you know? Whole foods improve digestion, enhance nutrient absorption, and keep energy levels high! Make every meal count! 🌿💪",
  "🏆 Power your workouts with smart nutrition! Complex carbs provide lasting energy, vitamins optimize health, and hydration keeps you going! 🍓💦",
  "💡 Eating clean isn’t about restriction—it’s about fueling your best self! Hydrate, choose fresh ingredients, and prioritize balance! 🏋️‍♂️🔥",
  "🎯 Smart eating = smart performance! The right foods enhance endurance, recovery, and strength. Fuel wisely for top results! 🍏💥",
  "🏋️‍♂️ Your diet shapes your body and mind! Prioritize lean proteins, fresh vegetables, whole grains, and healthy fats for unstoppable progress! 🍗🚀",
  "🌟 Superfoods like spinach, quinoa, and berries supercharge immunity and optimize body function! Make them part of your daily routine! 🥗🔥",
  "💥 Nutrition isn’t just about calories—it’s about quality! Whole foods nourish your body, improve recovery, and support peak performance! 🎉💡",
  "🍽️ Small, frequent meals keep metabolism high and energy levels steady! Plan, prep, and make every bite work toward your fitness goals! 🚀🥑",
  "🚴‍♂️ Did you know? Eating protein 30 minutes after a workout aids muscle recovery and strength-building! Time those nutrients right! 💪🍳",
  "🔥 Hydration and nutrition go hand-in-hand! Drinking enough water ensures proper digestion and helps transport essential nutrients efficiently! 💦🍽️",
  "💡 Want better focus and endurance? Swap processed foods for nutrient-dense whole foods rich in vitamins, minerals, and antioxidants! 🍏⚡",
  "🏆 Your body is a machine—give it the fuel it deserves! High-quality proteins, complex carbs, and omega-3s keep your system running smoothly! 🍣🥦",
  "🚀 Skip the fad diets—long-term nutrition success comes from balance, consistency, and mindful eating habits! Stay the course! 🏋️‍♂️🔥",
  "🎯 Healthy eating is an act of self-care! Nourishing your body with essential nutrients ensures strength, energy, and long-term well-being! 🥗💡",
  "💪 Nutrition doesn’t have to be complicated! Focus on whole ingredients, limit processed foods, and fuel your workouts wisely! 🍳🔥",
  "🌟 Meal timing matters! A balanced breakfast jumpstarts metabolism, post-workout nutrition aids recovery, and dinner should be nutrient-rich but light! 🍽️💪",
  "💥 Did you know? Fiber aids digestion, regulates blood sugar, and keeps hunger in check! Load up on greens, fruits, and whole grains! 🥦🍎",
  "🥗 Eating right isn’t just about macros—it’s about micronutrients too! Vitamins and minerals play a key role in recovery, immunity, and brain function! 🚀🍏",
  "🔥 Consistency is key! Meal prep, smart grocery shopping, and mindful eating ensure long-term nutrition success! Stay dedicated! 💡🏋️‍♂️",
  "🚀 Cut back on sugar—it drains energy, causes inflammation, and messes with digestion! Swap refined sugar for natural alternatives like honey and fruits! 🍯🍓",
  "🏆 Your gut health affects your overall wellness! Fermented foods like yogurt, kimchi, and sauerkraut support digestion and immunity! 🥗💡",
  "🍽️ Eating enough protein is essential for muscle repair! Aim for at least 1.2g of protein per kilogram of body weight! 💪🍗",
  "🌟 A well-balanced plate consists of protein, fiber, healthy fats, and complex carbs! Aim for variety in every meal! 🥑🥗",
  "💡 Smart snacking fuels your body between meals! Nuts, fruits, and Greek yogurt are great nutrient-dense options! 🍏🍽️",
  "🏋️‍♂️ Forget crash diets—your body thrives on sustainability! Stick to whole foods, exercise regularly, and embrace a balanced lifestyle! 🚀🔥",
  "🚴‍♂️ Antioxidants in fruits and veggies combat inflammation and enhance recovery! Load up on colorful produce to fight oxidative stress! 🍓🥦",
  "✨ Your plate should be as colorful as possible! Different colored foods provide unique nutrients—eat the rainbow for optimal health! 🌈🍽️",
  "💥 Strength starts in the kitchen! You can’t out-train a bad diet—prioritize high-quality nutrition to support your hard work! 🔥💪",
  "🎯 Magnesium plays a key role in muscle function and recovery! Eat almonds, spinach, and bananas to boost intake naturally! 🍌🥗",
  "🔥 Want better skin, digestion, and energy? Eat more fiber-rich foods, drink more water, and reduce processed sugars! 🏆🚀",
  "💡 Your metabolism thrives on real food! Skip fast food and cook at home for fresher, nutrient-packed meals! 🍽️🔥",
  "🚀 You deserve to feel strong and energized! Prioritize hydration, whole foods, and nutrient balance for peak wellness! 💪🍏",
  "🌟 Nutrition is about fueling greatness—not restriction! Find a meal plan that supports your goals and enjoy the journey! 🍽️💥",
  "💪 Your diet should support your lifestyle, not control it! Eat foods that help you perform, recover, and feel your best! 🚴‍♂️🍎",
  "🔥 Eating mindfully improves digestion, prevents overeating, and enhances nutrient absorption! Slow down and savor every bite! 🍽️💡",
  "🏋️‍♂️ Proper nutrition strengthens not just your body, but your mind too! Fuel wisely for better focus and cognitive function! 🧠🥦",
  "💥 Your nutrition should be simple, enjoyable, and sustainable! Make healthy choices that fit YOUR life! 🚀🍽️",
  "🍎 When in doubt, choose whole foods! If it grew from the earth or had a natural source, it’s likely the best choice! 🌿🔥",
];

if (userInput.includes('nutrition') || userInput.includes('diet') || userInput.includes('food')) {
  const randomNutritionMessage = nutritionResponses[Math.floor(Math.random() * nutritionResponses.length)];
  return {
    text: randomNutritionMessage,
    sender: 'bot'
  };
}


const sleepResponses = [
  "😴 Rest up! Aim for 7-9 hours of quality sleep to help muscle recovery and boost overall health! 🛏️💪",
  "🔥 Sleep isn’t just downtime—it’s when your body repairs and grows! Get 8 hours for maximum recovery! 💤✨",
  "🚀 Recovery is key! Recharge with 7-9 hours of restful sleep to come back stronger! 💪🌙",
  "🏆 Did you know? Deep sleep enhances muscle growth and endurance! Prioritize at least 8 hours per night! 🛏️🔥",
  "💡 Rest smarter! Stick to a 7-9 hour sleep schedule to optimize recovery and performance! 🌙😴",
  "🎯 Sleep isn’t a luxury—it’s essential! Get your 8 hours in for peak energy and focus! 🔥💤",
  "🏋️‍♂️ Your body rebuilds while you sleep! Aim for 7-9 hours nightly to power your fitness gains! 💪🛌",
  "🌟 Better sleep = better workouts! Get a solid 8 hours for maximum strength and endurance! 🏆🚀",
  "💥 Skipping sleep slows progress! Keep those gains coming with a consistent 7-9 hour rest! 🛏️💤",
  "✨ Sleep well, train hard, repeat! Recovery fuels strength—lock in at least 8 hours per night! 🚀😴",
];

if (userInput.includes('sleep') || userInput.includes('rest') || userInput.includes('recovery')) {
  const randomSleepMessage = sleepResponses[Math.floor(Math.random() * sleepResponses.length)];
  return {
    text: randomSleepMessage,
    sender: 'bot'
  };
}



const workoutTips = [
  "🏋️ Strength comes with consistency! Stick to your routine and watch your progress skyrocket! 🚀",
  "🔥 Always engage your core! A strong core improves balance, stability, and posture in every workout!",
  "💪 Don't rush reps—controlled movements activate muscles better and prevent injuries! Slow and steady wins! 🏆",
  "🚶‍♂️ Walking is underrated! 10,000 steps a day can work wonders for your stamina and heart health! ❤️",
  "🍽️ Nutrition is key! 80% fitness is diet, 20% is exercise. Fuel your body with the right foods! 🥦🍗",
  "🏃 Sprinting improves cardiovascular health, burns fat fast, and builds explosive power! Try short bursts today!",
  "🚀 Proper warm-ups prevent injuries and improve performance! Take 5-10 minutes before every workout! 🔥",
  "💡 Compound exercises like squats and deadlifts engage multiple muscles and maximize efficiency! 🏋️‍♂️",
  "🎯 Rest days are just as important as workouts! Recovery builds muscle and prevents burnout! 💤",
  "🏆 Hydration is key! Drink 2-3 liters of water daily to optimize workouts and energy levels! 💦",
  "🔥 Mix up your routine! Your body adapts—change exercises every few weeks for best results! ⚡",
  "💪 Flexibility matters! Stretching improves mobility, reduces soreness, and enhances strength! 🚀",
  "✨ Music boosts workout performance! Pump up the beats and move with the rhythm! 🎶",
  "🍏 Post-workout nutrition aids recovery! Get protein within 30 minutes after training! 🍽️",
  "🏋️‍♀️ Resistance training strengthens bones and builds lean muscle! Lift heavy, lift smart! 💪",
  "🚴‍♂️ Cardio burns calories, but strength training builds metabolism! Balance both in your workouts! 🎯",
  "🔥 Mind-muscle connection improves results! Focus on engaging the right muscles with every rep! 🎯",
  "🚀 Short, high-intensity workouts are time-efficient and effective! Try HIIT for quick gains! 🔥",
  "💡 Bodyweight workouts work wonders! Push-ups, squats, and lunges build strength anytime, anywhere! 🏋️‍♂️",
  "🏆 Challenge yourself! Gradually increase weights, reps, or intensity to keep progressing! 🚀",
  "💥 Recovery tools like foam rolling relieve muscle tension and speed up healing! Try it! ⚡",
  "🎯 Sleep is essential for muscle growth and repair! Aim for 7-9 hours per night! 🌙",
  "💪 Stronger glutes improve posture, speed, and power! Add hip thrusts to your routine! 🏋️‍♂️",
  "🔥 Set clear fitness goals! Tracking progress helps keep motivation high! 🎯",
  "🏆 Include mobility training! Healthy joints keep workouts smooth and pain-free! 🚀",
  "🚀 Push yourself, but listen to your body! Rest when needed and avoid overtraining! 💡",
  "💪 Training legs improves full-body strength and boosts metabolism! Never skip leg day! 🏋️‍♀️",
  "🔥 Strengthen grip for better lifts! Farmers walks, deadlifts, and squeezing stress balls help! 🎯",
  "🏋️‍♂️ Sprinting builds explosiveness and endurance—try short, intense runs today! 🚀",
  "💡 Stay active outside the gym! Walk, bike, or play sports to stay fit all day! 🚴‍♂️",
  "🔥 Keep workouts fun! Join a class, train with a friend, or try something new! 🎯",
  "🚀 Form matters! Maintain proper technique to maximize gains and avoid injuries! 🏋️‍♂️",
  "💪 Progressive overload builds strength! Increase resistance gradually for solid results! ⚡",
  "🎉 Enjoy the journey! Celebrate small wins and stay committed to your fitness goals! 🚀",
];

if (userInput.includes('tips') || userInput.includes('advice')) {
  const randomTip = workoutTips[Math.floor(Math.random() * workoutTips.length)];
  return {
    text: randomTip,
    sender: 'bot'
  };
}

const motivationPhrases = [
  "🔥 Success doesn’t come from what you do occasionally, but from what you do consistently! Keep pushing! 💪🚀",
  "💥 Every champion was once a beginner! Start today and stay committed to become the best version of YOU! 🏆",
  "⏳ Results take time, but quitting won’t speed up the process! Stay strong, stay disciplined! 🔥",
  "💡 Discipline beats motivation! Motivation fades, but habits keep you going. Build strong habits today! 🏋️‍♂️",
  "✨ Believe in yourself! No one is stopping you but YOU! Break those limits and conquer your goals! 🏆🚀",
  "🦾 Your only competition is YOU! Aim to be 1% better than yesterday and progress will follow! 💪",
  "🚀 Every step forward, no matter how small, brings you closer to success! Keep moving! 💥",
  "🏋️‍♂️ Strength doesn’t come from what you can do, but from overcoming what you thought you couldn’t! 🔥",
  "🎯 Dream big, start small, but most importantly—START! 💡",
  "💥 If it doesn’t challenge you, it won’t change you! Push past the limits! 🚀",
  "💪 The hardest battles are fought within. Win the fight in your mind first! 🏆",
  "🔥 Keep grinding! You might not see it now, but every effort adds up! 💡",
  "💡 Be proud of every step forward—progress is progress, no matter how small! ⏳",
  "🚴‍♂️ Push yourself, because no one else is going to do it for you! 🏆",
  "🌟 Your body can stand almost anything—it's your mind you need to convince! 🔥",
  "💡 It’s not about having time, it’s about making time for what matters! ⏳",
  "🚀 Nothing is impossible—the word itself says ‘I’m possible’! 💥",
  "🎯 Results don’t come from wishes, they come from work! Keep hustling! 🔥",
  "🔥 Every setback is a setup for a comeback! Keep going! 🚀",
  "💪 Success is walking from failure to failure with no loss of enthusiasm! 🏆",
  "⏳ You are stronger than your excuses—push through! 💡",
  "🚴‍♂️ Motivation will get you started, but discipline will keep you going! 🏋️‍♂️",
  "🌟 Excuses don’t burn calories—hard work does! 🔥",
  "💡 The pain you feel today will be the strength you feel tomorrow! ⏳",
  "🏆 You don’t have to be extreme, just consistent! 💪",
  "🚀 Hard work beats talent when talent doesn’t work hard! 💥",
  "🔥 Don’t fear failure—fear being in the same place next year! ⏳",
  "💡 Believe in yourself—you are capable of more than you know! 🎯",
  "🏋️‍♂️ Sweat today so you can shine tomorrow! 💥",
  "🚀 Small progress is still progress—celebrate the wins! 🔥",
  "💪 Winners focus on winning, losers focus on winners—keep your eyes on YOUR goal! 🏆",
  "🌟 Keep moving forward—nothing grows in the comfort zone! 🎯",
  "🔥 The only bad workout is the one you didn’t do! 💡",
  "🏆 A goal without a plan is just a wish—stay committed! 🚀",
  "💡 You’ve got this! Every challenge is an opportunity! 💥",
  "🚀 Stay patient and trust the process—results WILL come! 🏋️‍♂️",
  "⏳ A little progress each day adds up to BIG results! 💪",
  "🔥 Do it for the future YOU—the one who will thank you for today’s effort! 💡",
  "💥 Hard times build strong people—keep pushing! 🚀",
  "💪 Success is the sum of small efforts repeated daily! 🏆",
  "🚴‍♂️ You get out what you put in—give your best every day! 🔥",
  "💡 Make it happen—no one else is going to do it for you! ⏳",
  "🔥 Prove them wrong—let success be your response! 🚀",
  "🏋️‍♂️ Train your mind and your body will follow! 💪",
  "🎯 Challenges are what make life interesting—overcoming them is what makes it meaningful! 💥",
  "🔥 Success is a journey, not a destination—keep going! 🚀",
  "💡 Stop doubting yourself—start believing in your greatness! 🏆",
  "🌟 Don’t limit your challenges—challenge your limits! 🎯",
  "⏳ Tough times don’t last, but tough people do! 💪",
  "🔥 Be stronger than your excuses! 🚀",
  "💡 Get comfortable being uncomfortable—that’s where growth happens! 🎯",
  "🎉 Make today count—you only get one shot at today! 💥",
  "🏆 Progress over perfection—just start and improve along the way! 🚀",
  "💪 What you do today defines your tomorrow—give it your all! ⏳",
  "🔥 You’re one decision away from a completely different life! 💡",
  "🚀 Don’t stop when you’re tired—stop when you’re done! 🏋️‍♂️",
  "🎯 The difference between ordinary and extraordinary is that little extra! 💥",
  "🏆 The mind will quit long before the body—train your mind to push further! 💪",
  "🔥 Keep hustling—the results will come! 🚀",
  "💡 One hour a day is only 4% of your time—make it count! ⏳",
  "🏋️‍♂️ Stay consistent—the most successful people are the most disciplined! 🎯",
  "💥 Work in silence, let success make the noise! 🚀",
  "💡 Be the hardest worker in the room—your effort will pay off! 🔥",
  "🔥 Fitness is a journey, not a destination—keep moving forward! 🚀",
  "💡 Make every rep, every step, every moment count! ⏳",
  "🚴‍♂️ Your body achieves what your mind believes—train with confidence! 💪",
];

if (userInput.includes('motivate') || userInput.includes('encourage') || userInput.includes('inspire') || userInput.includes('down') || userInput.includes('depressed') || userInput.includes('sad') || userInput.includes('lost')) {
  const randomMotivation = motivationPhrases[Math.floor(Math.random() * motivationPhrases.length)];
  return {
    text: randomMotivation,
    sender: 'bot'
  };
}


    // Update context based on user input
    const newContext = {...conversationContext};

    // Check for goals
    const goalKeywords = {
      "gain muscle": ["gain muscle", "build muscle", "muscle growth", "get bigger"],
      "lose fat": ["lose fat", "burn fat", "fat loss", "get lean"],
      "improve strength": ["improve strength", "get stronger", "strength training"],
      "cardio": ["cardio", "endurance", "stamina"],
      "general": ["general fitness", "stay fit", "get fit"]
    };

    // Check for experience levels
    const experienceKeywords = {
      "beginner": ["beginner", "new", "starting out"],
      "intermediate": ["intermediate", "some experience", "moderate"],
      "advanced": ["advanced", "experienced", "expert"]
    };

    // Update goal in context if detected
    for (const [goal, keywords] of Object.entries(goalKeywords)) {
      if (keywords.some(keyword => userInput.includes(keyword))) {
        newContext.goal = goal;
        break;
      }
    }

    // Update experience in context if detected
    for (const [level, keywords] of Object.entries(experienceKeywords)) {
      if (keywords.some(keyword => userInput.includes(keyword))) {
        newContext.experience = level;
        break;
      }
    }

    // Update the context state
    setConversationContext(newContext);

    // Generate response based on accumulated context
    if (newContext.goal && newContext.experience) {
      const workoutsList = WORKOUTS[newContext.goal][newContext.experience];
      const workoutText = workoutsList.map((exercise, index) => `${index + 1}. ${exercise}`).join('\n');
      return {
        text: `Here's a ${newContext.experience} workout plan for ${newContext.goal}:\n${workoutText}\n\nWould you like to save this as a personalized plan?`,
        sender: 'bot',
        showFormButton: true
      };
    }

    // If only goal is detected in this message but we have experience from previous
    if (newContext.goal && conversationContext.experience) {
      const workoutsList = WORKOUTS[newContext.goal][conversationContext.experience];
      const workoutText = workoutsList.map((exercise, index) => `${index + 1}. ${exercise}`).join('\n');
      return {
        text: `Here's a ${conversationContext.experience} workout plan for ${newContext.goal}:\n${workoutText}\n\nWould you like to save this as a personalized plan?`,
        sender: 'bot',
        showFormButton: true
      };
    }

    // If only experience is detected in this message but we have goal from previous
    if (newContext.experience && conversationContext.goal) {
      const workoutsList = WORKOUTS[conversationContext.goal][newContext.experience];
      const workoutText = workoutsList.map((exercise, index) => `${index + 1}. ${exercise}`).join('\n');
      return {
        text: `Here's a ${newContext.experience} workout plan for ${conversationContext.goal}:\n${workoutText}\n\nWould you like to save this as a personalized plan?`,
        sender: 'bot',
        showFormButton: true
      };
    }

    // If only goal is detected (no previous experience)
    if (newContext.goal) {
      return {
        text: `Great that you want to focus on "${newContext.goal}"! What's your experience level? (beginner, intermediate, advanced)`,
        sender: 'bot'
      };
    }

    // If only experience level is detected (no previous goal)
    if (newContext.experience) {
      return {
        text: `Thanks for sharing you're at ${newContext.experience} level. What's your fitness goal? (gain muscle, lose fat, improve strength, cardio, or general fitness)`,
        sender: 'bot'
      };
    }

    // Workout plan requests
    if (userInput.includes('workout') || userInput.includes('exercise') || userInput.includes('plan')) {
      return {
        text: "I can generate a personalized workout plan for you! Would you like to complete your fitness profile so I can create the perfect plan for your goals?",
        sender: 'bot',
        showFormButton: true
      };
    }
    
    // Form related
    if (userInput.includes('form') || userInput.includes('profile') || userInput.includes('details') || 
        userInput.includes('generate') || userInput.includes('create') || userInput.includes('personalized')) {
      return {
        text: "Would you like to complete your fitness profile to generate a personalized workout plan?",
        sender: 'bot',
        showFormButton: true
      };
    }

    // Default response for unrecognized input
    return {
      text: "Would you like to complete your fitness profile to generate a personalized workout plan?",
      sender: 'bot',
      showFormButton: true
    };
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (e) => {
    const { value, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      rest_days: checked
        ? [...prev.rest_days, value]
        : prev.rest_days.filter(day => day !== value)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsGeneratingPlan(true);
    
    try {
      // Save profile to Firestore
      await setDoc(doc(db, 'users', userEmail), {
        id: userEmail,
        ...formData,
        last_updated: new Date()
      }, { merge: true });
      
      // Add success message
      setMessages(prev => [
        ...prev, 
        { 
          text: 'Your fitness profile has been saved! Generating your personalized workout plan...', 
          sender: 'bot' 
        }
      ]);
      
      // Generate workout plan
      await onGeneratePlan({
        user_email: userEmail,
        days: 21,
        focus: formData.fitness_goal
      });
      
      setMessages(prev => [
        ...prev,
        {
          text: 'Workout plan generated successfully! Click the Dashboard button to view your plan.',
          sender: 'bot'
        }
      ]);
      
      setShowForm(false);
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [
        ...prev, 
        { 
          text: error.message || 'Failed to generate workout plan. Please try again.', 
          sender: 'bot' 
        }
      ]);
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  return (
    <div className={`chatbot-container ${isOpen ? 'open' : ''}`}>
      {isOpen ? (
        <div className="chatbot-window">
          <div className="chatbot-header">
            <h3>FitnGro Assistant</h3>
            <button 
              onClick={() => setIsOpen(false)}
              disabled={isGeneratingPlan}
            >
              x
            </button>
          </div>

          <div className="chat-content">
            <div className="chatbot-messages">
              {messages.map((msg, index) => (
                <div key={index} className={`message ${msg.sender}`}>
                  {msg.text}
                  {msg.showFormButton && (
                    <button 
                      className="form-toggle-btn"
                      onClick={() => !isGeneratingPlan && setShowForm(!showForm)}
                      disabled={isGeneratingPlan}
                    >
                      {showForm ? 'Back to Chat' : 'Complete Profile'}
                    </button>
                  )}
                </div>
              ))}
            </div>

            {showForm ? (
              <form onSubmit={handleSubmit} className="user-details-form">
                <div className="form-section">
                  <h4>Personal Information</h4>
                  <div className="form-row">
                    <label>
                      Age:
                      <input 
                        type="number" 
                        name="age" 
                        value={formData.age} 
                        onChange={handleInputChange} 
                        min="10" 
                        max="100" 
                        required 
                        disabled={isGeneratingPlan}
                      />
                    </label>
                    <label>
                      Gender:
                      <select 
                        name="gender" 
                        value={formData.gender} 
                        onChange={handleInputChange} 
                        required
                        disabled={isGeneratingPlan}
                      >
                        <option value="">Select</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </label>
                  </div>

                  <div className="form-row">
                    <label>
                      Height (cm):
                      <input 
                        type="number" 
                        name="height" 
                        value={formData.height} 
                        onChange={handleInputChange} 
                        min="100" 
                        max="250" 
                        required 
                        disabled={isGeneratingPlan}
                      />
                    </label>
                    <label>
                      Weight (kg):
                      <input 
                        type="number" 
                        name="weight" 
                        value={formData.weight} 
                        onChange={handleInputChange} 
                        min="30" 
                        max="200" 
                        required 
                        disabled={isGeneratingPlan}
                      />
                    </label>
                  </div>
                </div>

                <div className="form-section">
                  <h4>Fitness Profile</h4>
                  <label>
                    Body Type:
                    <select 
                      name="body_type" 
                      value={formData.body_type} 
                      onChange={handleInputChange} 
                      required
                      disabled={isGeneratingPlan}
                    >
                      <option value="">Select</option>
                      <option value="ectomorph">Ectomorph</option>
                      <option value="mesomorph">Mesomorph</option>
                      <option value="endomorph">Endomorph</option>
                    </select>
                  </label>

                  <label>
                    Experience Level:
                    <select 
                      name="experience_level" 
                      value={formData.experience_level} 
                      onChange={handleInputChange} 
                      required
                      disabled={isGeneratingPlan}
                    >
                      <option value="">Select</option>
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </label>

                  <label>
                    Activity Level:
                    <select 
                      name="activity_level" 
                      value={formData.activity_level} 
                      onChange={handleInputChange} 
                      required
                      disabled={isGeneratingPlan}
                    >
                      <option value="">Select</option>
                      <option value="sedentary">Sedentary</option>
                      <option value="active">Active</option>
                      <option value="highly_active">Highly Active</option>
                    </select>
                  </label>

                  <label>
                    Fitness Goal:
                    <select 
                      name="fitness_goal" 
                      value={formData.fitness_goal} 
                      onChange={handleInputChange} 
                      required
                      disabled={isGeneratingPlan}
                    >
                      <option value="">Select</option>
                      <option value="gain-muscle">Gain Muscle</option>
                      <option value="lose-fat">Lose Fat</option>
                      <option value="improve-strength">Improve Strength</option>
                      <option value="cardio">Cardio</option>
                      <option value="general">General Fitness</option>
                    </select>
                  </label>
                </div>

                <div className="form-section">
                  <h4>Rest Days</h4>
                  <div className="rest-days-container">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                      <label key={day} className="rest-day-option">
                        <input
                          type="checkbox"
                          name="rest_days"
                          value={day}
                          checked={formData.rest_days.includes(day)}
                          onChange={handleCheckboxChange}
                          disabled={isGeneratingPlan}
                        />
                        <span style={{color:'black'}} >{day}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="form-actions">
                  <button 
                    type="submit" 
                    className="submit-btn"
                    disabled={isGeneratingPlan}
                  >
                    {isGeneratingPlan ? 'Generating Plan...' : 'Save & Generate Plan'}
                  </button>
                  <button 
                    type="button" 
                    className="cancel-btn"
                    onClick={() => !isGeneratingPlan && setShowForm(false)}
                    disabled={isGeneratingPlan}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="chatbot-input">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Type your message..."
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  disabled={isGeneratingPlan}
                />
                <button 
                  onClick={handleSendMessage}
                  disabled={isGeneratingPlan}
                >
                  Send
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <button 
          className="chatbot-toggle" 
          onClick={() => setIsOpen(true)}
          disabled={isGeneratingPlan}
        >
          <img src="/public/chatbot.png" alt="Chat" />
        </button>
      )}
    </div>
  );
};

export default Chatbot;
