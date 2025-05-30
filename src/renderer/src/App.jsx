import Routes from './routes';
import { ThemeProvider } from '@emotion/react';
import { CodeEditorProvider } from './contexts/CodeEditorContext';
import { ApiProvider } from './contexts/ApiContext';
import { InjectorProvider } from './contexts/InjectorContext';
import { AnalysisProvider } from './contexts/AnalysisContext';
import { SettingsProvider } from './contexts/SettingsContext';

import theme from './theme';
const App = () => {
  return (
    <>
      <ThemeProvider theme={theme}>
        <SettingsProvider>
          <ApiProvider>
            <CodeEditorProvider>
              <InjectorProvider>
                <AnalysisProvider>
                  <Routes />
                </AnalysisProvider>
              </InjectorProvider>
            </CodeEditorProvider>
          </ApiProvider>
        </SettingsProvider>
      </ThemeProvider>
    </>
  );
};

export default App;