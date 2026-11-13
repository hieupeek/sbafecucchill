// === QUIZ APPLICATION LOGIC === //
(function() {
  'use strict';

  // --- STATE ---
  let questions = window.QUIZ_DATA || [];
  let currentIndex = 0;
  let userAnswers = {}; // { [questionId]: 'A' | 'B' | 'C' | 'D' }
  let bookmarks = new Set();
  let isAnswerVisible = false;
  let autoHideOnNext = false;
  let likes = 0;
  let currentGridFilter = 'all';
  let searchQuery = '';

  // --- DOM ELEMENTS ---
  const elCurrentIndexDisplay = document.getElementById('current-index-display');
  const elTotalCountDisplay = document.getElementById('total-count-display');
  const elProgressBarFill = document.getElementById('progress-bar-fill');
  const elProgressPercent = document.getElementById('progress-percent');
  const elStatCorrect = document.getElementById('stat-correct');
  const elStatWrong = document.getElementById('stat-wrong');

  const elQuestionNumber = document.getElementById('question-number');
  const elQuestionText = document.getElementById('question-text');
  const elOptionsList = document.getElementById('options-list');
  const elLettersColumn = document.getElementById('letters-column');

  const elBtnPrev = document.getElementById('btn-prev');
  const elBtnNext = document.getElementById('btn-next');

  const elAnswerHiddenCard = document.getElementById('answer-hidden-card');
  const elAnswerVisibleContent = document.getElementById('answer-visible-content');
  const elBtnToggleAnswer = document.getElementById('btn-toggle-answer');
  const elTextToggleAnswer = document.getElementById('text-toggle-answer');
  const elBtnToggleAnswerTop = document.getElementById('btn-toggle-answer-top');
  const elTextToggleAnswerTop = document.getElementById('text-toggle-answer-top');
  const elBtnRevealAnswer = document.getElementById('btn-reveal-answer');
  const elChkAutoHide = document.getElementById('chk-auto-hide');

  const elAuthorCommentText = document.getElementById('author-comment-text');
  const elCorrectLetterBadge = document.getElementById('correct-letter-badge');
  const elCorrectTextContent = document.getElementById('correct-text-content');
  const elExplanationBody = document.getElementById('explanation-body');
  const elUserResultFeedback = document.getElementById('user-result-feedback');

  const elLikeCounter = document.getElementById('like-counter');
  const elBtnBookmark = document.getElementById('btn-bookmark');

  const elGridModal = document.getElementById('grid-modal');
  const elBtnOpenGrid = document.getElementById('btn-open-grid');
  const elBtnCloseGrid = document.getElementById('btn-close-grid');
  const elBtnCloseGridFooter = document.getElementById('btn-close-grid-footer');
  const elQuestionsGridContainer = document.getElementById('questions-grid-container');
  const elSearchQuestionsInput = document.getElementById('search-questions-input');
  const elBtnResetProgress = document.getElementById('btn-reset-progress');

  const elShortcutsModal = document.getElementById('shortcuts-modal');
  const elBtnShortcuts = document.getElementById('btn-shortcuts');
  const elBtnCloseShortcuts = document.getElementById('btn-close-shortcuts');

  // --- LOCAL STORAGE HELPERS ---
  function loadPersistedState() {
    try {
      const savedAnswers = localStorage.getItem('quiz_user_answers');
      if (savedAnswers) userAnswers = JSON.parse(savedAnswers);

      const savedBookmarks = localStorage.getItem('quiz_bookmarks');
      if (savedBookmarks) bookmarks = new Set(JSON.parse(savedBookmarks));

      const savedIndex = localStorage.getItem('quiz_current_index');
      if (savedIndex !== null) {
        const idx = parseInt(savedIndex, 10);
        if (!isNaN(idx) && idx >= 0 && idx < questions.length) {
          currentIndex = idx;
        }
      }

      const savedAutoHide = localStorage.getItem('quiz_auto_hide');
      if (savedAutoHide !== null) {
        autoHideOnNext = savedAutoHide === 'true';
        elChkAutoHide.checked = autoHideOnNext;
      }

      const savedLikes = localStorage.getItem('quiz_likes');
      if (savedLikes !== null) {
        likes = parseInt(savedLikes, 10) || 0;
        updateLikeCounter();
      }
    } catch (e) {
      console.warn('Failed to load state from localStorage:', e);
    }
  }

  function saveState() {
    try {
      localStorage.setItem('quiz_user_answers', JSON.stringify(userAnswers));
      localStorage.setItem('quiz_bookmarks', JSON.stringify(Array.from(bookmarks)));
      localStorage.setItem('quiz_current_index', currentIndex.toString());
      localStorage.setItem('quiz_auto_hide', autoHideOnNext.toString());
      localStorage.setItem('quiz_likes', likes.toString());
    } catch (e) {
      console.warn('Failed to save state to localStorage:', e);
    }
  }

  // --- INIT ---
  async function init() {
    if (!questions || questions.length === 0) {
      try {
        const res = await fetch('questions.json');
        questions = await res.json();
      } catch (err) {
        console.error('Error fetching questions.json:', err);
      }
    }

    if (!questions || questions.length === 0) {
      elQuestionText.textContent = 'Không tìm thấy dữ liệu câu hỏi.';
      return;
    }

    loadPersistedState();
    setupEventListeners();
    renderCurrentQuestion();
    updateOverallStats();
  }

  // --- RENDER QUESTION ---
  function renderCurrentQuestion() {
    if (!questions[currentIndex]) return;
    const q = questions[currentIndex];

    // Header info
    elCurrentIndexDisplay.textContent = `Câu ${currentIndex + 1}`;
    elTotalCountDisplay.textContent = questions.length;
    elQuestionNumber.textContent = q.label || `Câu ${currentIndex + 1}`;
    elQuestionText.textContent = q.question;

    // Prev / Next button states
    elBtnPrev.disabled = currentIndex === 0;
    elBtnNext.disabled = currentIndex === questions.length - 1;

    // Bookmark button state
    if (bookmarks.has(q.id)) {
      elBtnBookmark.classList.add('bookmarked');
    } else {
      elBtnBookmark.classList.remove('bookmarked');
    }

    // Render Options
    elOptionsList.innerHTML = '';
    const letters = ['A', 'B', 'C', 'D'];
    const chosenAnswer = userAnswers[q.id];

    letters.forEach(letter => {
      const choiceText = (q.choices && q.choices[letter]) ? q.choices[letter] : '';
      if (!choiceText) return;

      const optionItem = document.createElement('div');
      optionItem.className = 'option-item';
      optionItem.dataset.choice = letter;

      const isSelected = chosenAnswer === letter;
      const isCorrectChoice = q.correct === letter;

      if (isSelected) {
        optionItem.classList.add('selected');
      }

      // If answer is revealed, show colors!
      if (isAnswerVisible) {
        if (isCorrectChoice) {
          optionItem.classList.add('is-correct');
        } else if (isSelected) {
          optionItem.classList.add('is-wrong');
        }
      }

      optionItem.innerHTML = `
        <span class="option-letter-prefix">${letter}.</span>
        <span class="option-text">${escapeHtml(choiceText)}</span>
      `;

      optionItem.addEventListener('click', () => {
        selectChoice(letter);
      });

      elOptionsList.appendChild(optionItem);
    });

    // Update left floating letter pills (A, B, C, D)
    const pills = elLettersColumn.querySelectorAll('.letter-pill');
    pills.forEach(pill => {
      const choice = pill.dataset.choice;
      pill.className = 'letter-pill';

      if (chosenAnswer === choice) {
        pill.classList.add('selected');
      }

      if (isAnswerVisible) {
        if (q.correct === choice) {
          pill.classList.add('correct-answer');
        } else if (chosenAnswer === choice) {
          pill.classList.add('wrong-answer');
        }
      }
    });

    // Render Right Panel (Answer & Explanation)
    renderAnswerPanel(q);

    // Update progress bar
    updateProgressBar();
  }

  // --- RENDER ANSWER PANEL ---
  function renderAnswerPanel(q) {
    const correctLetter = (q.correct || 'A').toUpperCase();
    const correctFullText = (q.choices && q.choices[correctLetter]) 
      ? q.choices[correctLetter] 
      : (q.correctText || '');

    // Comment card text (displays lowercase letter like "c" as in the user screenshot)
    elAuthorCommentText.textContent = correctLetter.toLowerCase();

    // Solution box
    elCorrectLetterBadge.textContent = correctLetter;
    elCorrectTextContent.textContent = `${correctLetter}. ${correctFullText}`;
    elExplanationBody.textContent = q.explanation || 'Không có giải thích bổ sung.';

    // User feedback
    const chosenAnswer = userAnswers[q.id];
    if (chosenAnswer) {
      if (chosenAnswer === correctLetter) {
        elUserResultFeedback.className = 'user-result-feedback is-correct';
        elUserResultFeedback.innerHTML = `✓ Bạn đã chọn chính xác đáp án <strong>${chosenAnswer}</strong>!`;
      } else {
        elUserResultFeedback.className = 'user-result-feedback is-wrong';
        elUserResultFeedback.innerHTML = `✗ Bạn đã chọn <strong>${chosenAnswer}</strong>. Đáp án đúng là <strong>${correctLetter}</strong>.`;
      }
    } else {
      elUserResultFeedback.className = 'user-result-feedback';
      elUserResultFeedback.textContent = '';
    }

    // Toggle Visibility UI
    applyAnswerVisibilityUI();
  }

  function applyAnswerVisibilityUI() {
    if (isAnswerVisible) {
      elAnswerHiddenCard.classList.remove('active');
      elAnswerVisibleContent.classList.remove('hidden');
      elTextToggleAnswer.textContent = 'Ẩn đáp án';
      elTextToggleAnswerTop.textContent = 'Ẩn đáp án';
    } else {
      elAnswerHiddenCard.classList.add('active');
      elAnswerVisibleContent.classList.add('hidden');
      elTextToggleAnswer.textContent = 'Hiện đáp án';
      elTextToggleAnswerTop.textContent = 'Hiện đáp án';
    }
  }

  // --- INTERACTIONS ---
  function selectChoice(letter) {
    const q = questions[currentIndex];
    if (!q) return;

    userAnswers[q.id] = letter;
    saveState();
    updateOverallStats();
    renderCurrentQuestion();
  }

  function toggleAnswerVisibility(explicitState) {
    if (typeof explicitState === 'boolean') {
      isAnswerVisible = explicitState;
    } else {
      isAnswerVisible = !isAnswerVisible;
    }
    applyAnswerVisibilityUI();
    renderCurrentQuestion();
  }

  function nextQuestion() {
    if (currentIndex < questions.length - 1) {
      currentIndex++;
      if (autoHideOnNext) {
        isAnswerVisible = false;
      }
      saveState();
      renderCurrentQuestion();
    }
  }

  function prevQuestion() {
    if (currentIndex > 0) {
      currentIndex--;
      if (autoHideOnNext) {
        isAnswerVisible = false;
      }
      saveState();
      renderCurrentQuestion();
    }
  }

  function toggleBookmark() {
    const q = questions[currentIndex];
    if (!q) return;

    if (bookmarks.has(q.id)) {
      bookmarks.delete(q.id);
    } else {
      bookmarks.add(q.id);
    }
    saveState();
    renderCurrentQuestion();
  }

  function updateLikeCounter() {
    elLikeCounter.querySelector('span').textContent = `Like (${likes})`;
  }

  function updateProgressBar() {
    const answeredCount = Object.keys(userAnswers).length;
    const percent = Math.round((answeredCount / questions.length) * 100);
    elProgressBarFill.style.width = `${percent}%`;
    elProgressPercent.textContent = `${percent}%`;
  }

  function updateOverallStats() {
    let correctCount = 0;
    let wrongCount = 0;

    questions.forEach(q => {
      const userChoice = userAnswers[q.id];
      if (userChoice) {
        if (userChoice === q.correct) {
          correctCount++;
        } else {
          wrongCount++;
        }
      }
    });

    elStatCorrect.textContent = correctCount;
    elStatWrong.textContent = wrongCount;
  }

  // --- QUESTION GRID MODAL ---
  function openQuestionGrid() {
    renderGridQuestions();
    elGridModal.classList.add('open');
    elSearchQuestionsInput.focus();
  }

  function closeQuestionGrid() {
    elGridModal.classList.remove('open');
  }

  function renderGridQuestions() {
    elQuestionsGridContainer.innerHTML = '';

    const query = searchQuery.trim().toLowerCase();

    questions.forEach((q, idx) => {
      // Filtering
      const chosen = userAnswers[q.id];
      const isCorrect = chosen && chosen === q.correct;
      const isWrong = chosen && chosen !== q.correct;
      const isBookmarked = bookmarks.has(q.id);

      if (currentGridFilter === 'unanswered' && chosen) return;
      if (currentGridFilter === 'correct' && !isCorrect) return;
      if (currentGridFilter === 'wrong' && !isWrong) return;
      if (currentGridFilter === 'bookmarked' && !isBookmarked) return;

      if (query) {
        const textToSearch = (q.question + ' ' + Object.values(q.choices || {}).join(' ')).toLowerCase();
        if (!textToSearch.includes(query)) return;
      }

      const btn = document.createElement('button');
      btn.className = 'grid-q-btn';
      btn.textContent = idx + 1;

      if (idx === currentIndex) {
        btn.classList.add('current');
      }

      if (isCorrect) {
        btn.classList.add('status-correct');
      } else if (isWrong) {
        btn.classList.add('status-wrong');
      }

      if (isBookmarked) {
        btn.classList.add('status-bookmarked');
      }

      btn.addEventListener('click', () => {
        currentIndex = idx;
        if (autoHideOnNext) isAnswerVisible = false;
        saveState();
        renderCurrentQuestion();
        closeQuestionGrid();
      });

      elQuestionsGridContainer.appendChild(btn);
    });

    if (elQuestionsGridContainer.children.length === 0) {
      elQuestionsGridContainer.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #94a3b8; padding: 30px;">Không tìm thấy câu hỏi phù hợp.</div>';
    }
  }

  // --- SHORTCUTS MODAL ---
  function openShortcuts() {
    elShortcutsModal.classList.add('open');
  }

  function closeShortcuts() {
    elShortcutsModal.classList.remove('open');
  }

  // --- EVENT LISTENERS ---
  function setupEventListeners() {
    // Navigation
    elBtnPrev.addEventListener('click', prevQuestion);
    elBtnNext.addEventListener('click', nextQuestion);

    // Toggle Answer
    elBtnToggleAnswer.addEventListener('click', () => toggleAnswerVisibility());
    elBtnToggleAnswerTop.addEventListener('click', () => toggleAnswerVisibility());
    elBtnRevealAnswer.addEventListener('click', () => toggleAnswerVisibility(true));

    // Auto-hide switch
    elChkAutoHide.addEventListener('change', (e) => {
      autoHideOnNext = e.target.checked;
      saveState();
    });

    // Bookmark
    elBtnBookmark.addEventListener('click', toggleBookmark);

    // Like counter
    elLikeCounter.addEventListener('click', () => {
      likes++;
      updateLikeCounter();
      saveState();
    });

    // Floating letter pills click (A, B, C, D)
    elLettersColumn.querySelectorAll('.letter-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        selectChoice(pill.dataset.choice);
      });
    });

    // Modal Grid
    elBtnOpenGrid.addEventListener('click', openQuestionGrid);
    elBtnCloseGrid.addEventListener('click', closeQuestionGrid);
    elBtnCloseGridFooter.addEventListener('click', closeQuestionGrid);

    // Grid filters
    const filterPills = document.querySelectorAll('.filter-pill');
    filterPills.forEach(pill => {
      pill.addEventListener('click', () => {
        filterPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        currentGridFilter = pill.dataset.filter;
        renderGridQuestions();
      });
    });

    // Grid search
    elSearchQuestionsInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderGridQuestions();
    });

    // Reset Progress
    elBtnResetProgress.addEventListener('click', () => {
      if (confirm('Bạn có chắc chắn muốn xóa toàn bộ câu trả lời để làm lại từ đầu không?')) {
        userAnswers = {};
        saveState();
        updateOverallStats();
        renderCurrentQuestion();
        renderGridQuestions();
      }
    });

    // Shortcuts modal
    elBtnShortcuts.addEventListener('click', openShortcuts);
    elBtnCloseShortcuts.addEventListener('click', closeShortcuts);

    // Close modals on background click
    elGridModal.addEventListener('click', (e) => {
      if (e.target === elGridModal) closeQuestionGrid();
    });
    elShortcutsModal.addEventListener('click', (e) => {
      if (e.target === elShortcutsModal) closeShortcuts();
    });

    // --- KEYBOARD SHORTCUTS ---
    window.addEventListener('keydown', (e) => {
      // Don't trigger shortcuts if user is typing in search input
      if (document.activeElement === elSearchQuestionsInput) {
        if (e.key === 'Escape') closeQuestionGrid();
        return;
      }

      // Close modal on Escape
      if (e.key === 'Escape') {
        closeQuestionGrid();
        closeShortcuts();
        return;
      }

      // Prev / Next
      if (e.key === 'ArrowRight' || (e.key === 'Enter' && !elGridModal.classList.contains('open'))) {
        e.preventDefault();
        nextQuestion();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevQuestion();
      }

      // Space or H: Toggle answer
      if (e.key === ' ' || e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        toggleAnswerVisibility();
      }

      // Number keys 1-4 or letters A-D: select choice
      if (e.key === '1' || e.key === 'a' || e.key === 'A') {
        selectChoice('A');
      } else if (e.key === '2' || e.key === 'b' || e.key === 'B') {
        selectChoice('B');
      } else if (e.key === '3' || e.key === 'c' || e.key === 'C') {
        selectChoice('C');
      } else if (e.key === '4' || e.key === 'd' || e.key === 'D') {
        selectChoice('D');
      }

      // 'G' opens question grid
      if (e.key === 'g' || e.key === 'G') {
        if (elGridModal.classList.contains('open')) {
          closeQuestionGrid();
        } else {
          openQuestionGrid();
        }
      }

      // 'F' bookmarks question
      if (e.key === 'f' || e.key === 'F') {
        toggleBookmark();
      }

      // '?' opens shortcuts
      if (e.key === '?') {
        if (elShortcutsModal.classList.contains('open')) {
          closeShortcuts();
        } else {
          openShortcuts();
        }
      }
    });
  }

  // --- UTILITY ---
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Run on page ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

